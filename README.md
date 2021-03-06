# Socketauth

Experiment to proxy ssh-agent protocol over http.

Start server on hos with a running ssh-agent:

``` bash
./bin/soauth-server.js
```

Use soauth on command that needs remote key access:

``` bash
SOAUTH_URL=http://test:test@localhost:3000/ssh-agent ./bin/soauth.js ssh -T git@github.com
Hi tlbdk! You've successfully authenticated, but GitHub does not provide shell access.
```

Using soauth with git:

sshsoauth.sh:

``` bash
#!/bin/bash
exec ./bin/soauth.js $@
```

Tell git to use the wrapper:

``` bash
GIT_SSH=./sshsoauth.sh git clone git@github.com
```
