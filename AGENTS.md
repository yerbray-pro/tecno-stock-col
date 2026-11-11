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
- User names live in profiles and permissions in user_roles; verify the existing signup trigger's worker role before attempting assignment because account creation is not proof of authorization.
- Purchasing uses reviewed ts_compras RPCs and real inventory IDs; never fall back to local example orders because receipt must be atomic and durable.
- Purchasing administration and receiving share an order component; partition purchase queries by identity/role, and derive persisted order prices from locked supplier catalog rows in the RPC to prevent cross-role cache exposure and forged prices.
- Product writes use ts_guardar_producto; initial stock is an internal registrar_movimiento call in the same transaction and edits omit quantity to preserve stock invariants.
- Keep receipt retry keys and immutable payloads in sessionStorage until confirmation; this stores no authorization and prevents an uncertain network response from duplicating a receipt.
- Stock classification and Colombian calendar grouping live in shared data/analysis helpers so dashboard and analysis cannot disagree.
- Inventory AI verifies the existing Auth session and database role, reads with the caller's RLS, and reserves durable usage through a reviewed manual RPC before calling the provider; missing quota installation fails closed.
- AI selects product references and explanation lenses through a strict schema; deterministic templates own all displayed facts and quantities to prevent model-invented inventory values.
- AI calls use server-only OpenAI Responses through Lovable AI Gateway, with explicit cancellation and no automatic retry; no provider call runs on page load.
