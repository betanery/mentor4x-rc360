drop policy if exists lessons_select_auth on public.lessons;

create policy lessons_select_auth
on public.lessons
for select
to authenticated
using (
  public.is_staff(auth.uid())
  or exists (
    select 1 from public.courses c
    where c.id = lessons.course_id
      and c.published = true
  )
);