# OddJobs Marketplace — Product & Permission Model

## Roles

Roles come from server-side assignments. Client-selected workspace routes never grant permissions.

| Capability | Customer | Provider | Admin |
|---|---:|---:|---:|
| Browse open provider listings | Yes | No | Yes |
| Claim an open listing | Yes | No | Audited intervention only |
| Create and manage own listings | No | Yes, when approved | Audited intervention only |
| See the assigned customer | Own claims | Own listings | All listings |
| Manage active work | Own claims | Own listings | All work |
| Search platform-wide marketplace activity | No | No | Yes, audited |

## Listing lifecycle

```text
open → claimed → in_progress → completion_pending → completed
  ↘        ↘
 cancelled  cancelled
  claimed → open when the unstarted claim expires
```

- A provider can publish listings only after provider approval.
- Only active customers can see open listings; they cannot see another customer's claim.
- A claim is a single conditional database update. Concurrent claims have one winner.
- Unstarted claims expire after 15 minutes and return to the open feed.
- Only the listing's provider can close an open listing or advance provider work states.
- Only the assigned customer can cancel a claim or confirm completion.
- Admin listing reads include provider, customer, status, and activity history and are audited.

## Legacy jobs and quotes

Existing job and quote rows remain available for historical review and completion. New customer job creation, provider quote submission, and quote acceptance are retired. Providers cannot use legacy open-job feeds or read unrelated legacy job details.

## Audit and privacy

Customer/provider listing actions are appended to the listing activity log. Admin marketplace reads and interventions are recorded in the admin audit log. Customer contact data is exposed only to the assigned provider through participant-scoped APIs.
