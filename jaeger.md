# Tracing to a local Jaeger

Run a local instance of the collector and Jaeger:

`docker-compose up`

This is set up to send to both Jaeger and Honeycomb.
You can let the calls to Honeycomb fail for now.

When you're ready to view traces in Honeycomb as well,
put a HONEYCOMB_API_KEY either in your environment variables,
or in a file called `.env`

Sample `.env` (replace gobbledeegook with your real key):

```
export HONEYCOMB_API_KEY=aaabb23423423fsdfas
```

Access Jaeger: https://localhost:16686
