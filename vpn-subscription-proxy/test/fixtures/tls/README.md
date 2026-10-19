# Synthetic TLS fixture

`fullchain.pem` is a self-signed test certificate for `proxy.example.com`.
`privkey.pem` is its intentionally public test key, generated solely for
these tests. Neither file is used by a running proxy or any real service.
`multi-fullchain.pem` uses the same test key and adds `alternate.example.com`
to verify explicit hostname selection for multi-SAN certificates.

The tests choose an explicit time inside/outside the certificate validity
period and use an in-memory filesystem. They do not read `/root`, systemd
credentials or production TLS material on the test machine.
