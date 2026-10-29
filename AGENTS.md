<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Movements uses the existing browser Supabase client and a single database RPC; never update stock separately from inserting its movement, to preserve atomicity.
- External database changes are delivered as reviewed manual SQL under sql/ when no database connection is available; do not provision a replacement backend.
- Movement writes require server-validated identity and database-side roles; UI guards and browser state are not authorization.
- External Supabase auth uses the existing browser client, a client-only pathless route gate, and bearer middleware; every administrative server function independently validates identity and database role before privileged work.
- User names live in profiles and permissions in user_roles; profile creation never grants access, and only an authenticated administrator assigns roles through the database function.
