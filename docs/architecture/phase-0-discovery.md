# Phase 0 — Discovery na Maswali kwa Client

Kabla ya coding na kabla ya kutoa **final fixed price**, client lazima ajibu maswali haya.
Majibu yataathiri gharama, timeline, server architecture na integrations.

## A. Devices na Vendors

| # | Swali | Jibu la Client | Inaathiri |
|---|---|---|---|
| 1 | Ni biometric brands zipi zitatumika? (ZKTeco, Suprema, Hikvision, ...) | _pending_ | `integration-gateway` adapters, device SDK |
| 2 | CCTV ni Hikvision, Dahua au vendor mwingine? | _pending_ | NVR/VMS integration, `vision-ai-service` |
| 3 | ANPR itatoka kwa camera vendor au system ijenge AI yake? | _pending_ | Scope ya `vision-ai-service`, GPU servers |
| 7 | Cameras na gates zitakuwa ngapi? | _pending_ | MQTT broker sizing, storage sizing |

## B. Scale na Volumes

| # | Swali | Jibu la Client | Inaathiri |
|---|---|---|---|
| 4 | Guards watakuwa wangapi? | _pending_ | Attendance/alertness event volumes, DB sizing |
| 5 | Customer companies watakuwa wangapi? | _pending_ | Tenancy model, RLS design |
| 6 | Sites na branches zitakuwa ngapi? | _pending_ | Deployment topology, offline requirements |
| 8 | System itahitaji offline operation? (sites zenye internet dhaifu) | _pending_ | Guard app offline-first scope, sync engine |
| 9 | Mobile apps zitakuwa Android tu au Android na iOS? | _pending_ | Build pipeline, testing, gharama |

## C. Payroll na Finance

| # | Swali | Jibu la Client | Inaathiri |
|---|---|---|---|
| 10 | Customer payroll itafuata statutory rules zipi? (PAYE, NSSF, WCF, SDL, HESLB...) | _pending_ | Payroll engine rules versioning |
| 11 | Bank payment files zitakuwa za banks zipi? (CRDB, NMB, NBC, ...) | _pending_ | Bank adapters, file formats |
| 12 | Mobile money providers ni zipi? (M-Pesa, TigoPesa, Airtel Money, HaloPesa) | _pending_ | Payment adapters |
| 17 | Finance module ni billing tu au full accounting/general ledger? | _pending_ | Scope kubwa — GL, trial balance, chart of accounts |

## D. Data, Security na SLA

| # | Swali | Jibu la Client | Inaathiri |
|---|---|---|---|
| 13 | CCTV footage itahifadhiwa kwa muda gani? | _pending_ | Storage costs, retention policies |
| 14 | Biometric raw data itahifadhiwa au templates pekee? | _pending_ | Data protection compliance, storage |
| 15 | SLA ya system ni 99.5%, 99.9% au zaidi? | _pending_ | HA architecture, redundancy, gharama |
| 16 | RPO na RTO ni zipi? | _pending_ | Backup strategy, DR site |
| 18 | Kila customer atakuwa tenant kamili au customer record ndani ya company moja? | _pending_ | Tenancy architecture — kubwa zaidi ya maamuzi yote |

## E. Deliverables za Phase 0 (kabla ya Phase 1)

- [ ] Confirm all business workflows na business owners
- [ ] Complete authority matrix (document section 35B — bado haijajazwa kikamilifu)
- [ ] Complete viewing hierarchy (document section 35D — bado haijajazwa kikamilifu)
- [ ] Identify device vendors (biometrics, CCTV, ANPR, RFID, barriers)
- [ ] Identify payment providers (banks + mobile money)
- [ ] Define payroll rules (company + customer, statutory)
- [ ] Define customer isolation model (tenant vs customer record)
- [ ] Define data retention policies (CCTV, biometrics, audit)
- [ ] Define expected volumes (guards, sites, events/sec, cameras)
- [ ] Produce final API na database architecture (update `system-architecture.md`)
