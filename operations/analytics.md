# Conversion Analytics

The site uses two complementary Cloudflare systems:

- Cloudflare Web Analytics for privacy-conscious page and performance measurement
- Workers Analytics Engine dataset `prime_analytics_events` for approved conversion events

## Events

| Event | Meaning |
|---|---|
| `calendly_click` | A visitor opened the scheduling link |
| `email_click` | A visitor opened the email link |
| `blueprint_examples_click` | A visitor opened the fictional examples from a sales page |
| `sample_saas_select` | A visitor selected the SaaS example |
| `sample_services_select` | A visitor selected the services example |
| `sample_print` | A visitor used Save as PDF |
| `attribution_landing_click` | A visitor opened the attribution landing page from the homepage |

Each event stores only the approved event name and page path. The implementation does not write email addresses, form contents, IP addresses, user-agent strings, or query parameters to the Analytics Engine dataset.

## Example 30-day query

Run through the Cloudflare Analytics Engine SQL API using an API token with the minimum necessary read permission:

```sql
SELECT
  blob1 AS event,
  blob2 AS path,
  COUNT() AS events
FROM prime_analytics_events
WHERE timestamp > NOW() - INTERVAL '30' DAY
GROUP BY event, path
ORDER BY events DESC
```

## Funnel review

Review monthly until traffic is sufficient for weekly review:

1. Homepage views
2. `blueprint_examples_click`
3. `sample_saas_select` versus `sample_services_select`
4. `sample_print`
5. `calendly_click` by path
6. Completed Calendly bookings
7. Qualified opportunities

Analytics Engine records clicks, not completed bookings. Reconcile scheduling clicks with Calendly's completed bookings rather than treating every click as a lead.

