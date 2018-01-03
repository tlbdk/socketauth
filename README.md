# Socketauth

Experiment to proxy ssh-agent protocol over http.

``` bash
SOAUTH_URL=http://test:test@localhost:3000/ssh-agent ./bin/soauth.js ssh -T git@github.com
```

``` bash
./bin/soauth-server.js
```
