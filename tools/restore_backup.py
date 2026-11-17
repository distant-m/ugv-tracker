#!/usr/bin/env python3
"""Turn a tracker backup (backup_YYYY-MM-DD.json) into SQL for the Supabase SQL Editor.

usage: python3 restore_backup.py backup_2026-11-22.json [--exact] > restore.sql

  default  – upsert: rows from the backup are written back; rows created later stay.
  --exact  – also deletes rows that are not in the backup (content tables only),
             so the system looks exactly as on the backup date.
The audit log is never deleted or changed: missing entries are only added back.
Profiles are restored only for logins that still exist in Supabase Auth.
"""
import json, sys

ORDER = ['settings', 'tracks', 'stages', 'positions', 'staff_slots', 'groups',
         'procurement', 'indicators', 'admin_tasks']
PK = {'settings': 'key'}
JSONB_DEF = {('settings', 'value'): "coalesce({0}, 'null'::jsonb)", ('groups', 'facts'): "coalesce({0}, '{{}}'::jsonb)",
             ('groups', 'docs'): "coalesce({0}, '{{}}'::jsonb)", ('indicators', 'fm'): "coalesce({0}, '{{}}'::jsonb)"}
EXACT_DELETE = ['groups', 'procurement', 'indicators', 'admin_tasks', 'staff_slots', 'positions', 'stages', 'tracks']


def lit(obj):
    s = json.dumps(obj, ensure_ascii=False)
    tag = '$bk$'
    while tag in s:
        tag = tag[:-1] + 'x$'
    return f"{tag}{s}{tag}::jsonb"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    exact = '--exact' in sys.argv
    data = json.load(open(args[0], encoding='utf-8'))
    assert data.get('format') == 'ugv-tracker-backup', 'not a tracker backup file'
    T = data['tables']
    out = [f"-- Відновлення з резервної копії від {data['created']} ({'точне' if exact else 'дописування'})",
           'begin;']
    for tb in ORDER:
        rows = T.get(tb) or []
        if not rows:
            continue
        pk = PK.get(tb, 'id')
        cols = sorted({k for r in rows for k in r})
        upd = ', '.join(f'{c} = excluded.{c}' for c in cols if c != pk)
        collist = ', '.join(cols)
        sel = ', '.join(JSONB_DEF[(tb, c)].format(c) if (tb, c) in JSONB_DEF else c for c in cols)
        out.append(f"insert into public.{tb} ({collist})\n  select {sel} from jsonb_populate_recordset(null::public.{tb}, {lit(rows)})\n  on conflict ({pk}) do update set {upd};")
    if exact:
        for tb in EXACT_DELETE:
            rows = T.get(tb) or []
            pk = PK.get(tb, 'id')
            keys = [r[pk] for r in rows]
            out.append(f"delete from public.{tb} where {pk}::text <> all (select jsonb_array_elements_text({lit(keys)}));")
    prof = T.get('profiles') or []
    if prof:
        cols = [c for c in sorted({k for r in prof for k in r}) if c != 'id']
        sets = ', '.join(f'{c} = b.{c}' for c in cols)
        out.append(f"update public.profiles p set {sets}\n  from jsonb_populate_recordset(null::public.profiles, {lit(prof)}) b where p.id = b.id;")
    aud = T.get('audit_log') or []
    if aud:
        cols = sorted({k for r in aud for k in r})
        collist = ', '.join(cols)
        out.append(f"insert into public.audit_log ({collist}) overriding system value\n  select {collist} from jsonb_populate_recordset(null::public.audit_log, {lit(aud)}) b\n  where not exists (select 1 from public.audit_log a where a.id = b.id);")
        out.append("select setval(pg_get_serial_sequence('public.audit_log','id'), (select greatest(max(id), 1) from public.audit_log));")
    out.append('commit;')
    out.append("select 'groups' t, count(*) from public.groups union all select 'staff_slots', count(*) from public.staff_slots union all select 'audit_log', count(*) from public.audit_log;")
    print('\n\n'.join(out))


if __name__ == '__main__':
    main()
