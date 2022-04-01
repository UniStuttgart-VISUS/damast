# User Roles

Each user has a set of roles they are part of. Individual Flask endpoints in
turn are set to allow a certain set of roles. A user is then allowed to use an
endpoint if these two sets of roles overlap.

There is a basic `user` role that gives access to basic functionality behind
the login, but just being part of that role is not enough if the endpoint wants
a more specific role. Further, there is a `dev` role for endpoints that are
important for developing, but not for users, such as the REST API
documentation. Finally, there is an `admin` role, which should provide access
to **all** endpoints.

For the REST API, there is the distinction between users without REST API
access, those that can read and those that can read and write. For this, there
are two roles, `readdb` and `writedb`, and a user has either none, only
`readdb`, or `readdb` and `writedb`. `writedb` provides access to changing
endpoints in the REST API, which will modify database state, while `readdb`
allows to query, but not modify. In the backend, this is controlled mainly by
differentiating HTTP verbs: `GET` requests are read-only, `PATCH`, `PUT` and
`DELETE` are writing. Read-only users are also passed a read-only cursor to the
endpoint code.

For different functionalities of the site, there are more specific roles, where
users can just be part of one or a few:

| Role | Usage |
| :--- | :---- |
| `annotator` | Allows access to the annotator. |
| `geodb` | Allows access to the GeoDB-Editor. |
| `pgadmin` | Allows access to pgAdmin. |
| `reporting` | Allows access to the reporting functionality. |
| `vis` | Allows access to the visualization. |
| `visitor` | This role is given to visitors alongside those in `DAMAST_VISITOR_ROLES`, if visitor handling is enabled. |
