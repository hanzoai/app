# @hanzo/app

The Hanzo workspace — Home, Chat, Inbox, Contacts, Meet, Cal, Drive, Board,
Work, Bots and the shell that holds them — as one package that every surface
imports.

```tsx
import { configure, Host } from '@hanzo/app'
import { Shell } from '@hanzo/app/Shell'
import { CalScheduler } from '@hanzo/app/CalScheduler'

configure({ site: '', home: '/home', signUp: '/signup' })

<Host router={router} path={pathname} route={route} Link={Link}>
  <Shell mode="cal"><CalScheduler /></Shell>
</Host>
```

`configure()` names the host's addresses (where its own pages live, the
gateway and IAM, the plan catalogue to paint first). `<Host>` carries what
moves: the router, the path, the route and the link component. The apps
import nothing from a host, and their look comes from `@hanzo/appearance` and
`@hanzo/design` through `@hanzo/ui`.
