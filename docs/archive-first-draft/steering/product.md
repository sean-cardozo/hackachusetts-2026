# Product: Pharmacy Buying Pool

## Users
Purchasing managers at small, independent pharmacy chains in Massachusetts. Not CVS, Walgreens or other national chains.

## Problem
Slow-moving generic prescription drugs. Bulk price tiers need volume that these small chains do not have alone. So they either pay more per unit, or they buy big packs and tie up cash in stock that may expire.

## Solution
Chains commit their weekly needs to a shared pool. The pooled demand is what gets them a better price.

The flow is one chain of steps:
1. Upload: a chain uploads its purchase history and stock. The app cleans it and matches each line to a standard drug code (NDC).
2. Compare: each drug is compared to the government benchmark price (NADAC). The app also shows days of supply and FDA shortage alerts.
3. Swap: the app may suggest an FDA-rated equivalent product so more chains can buy the same thing.
4. Commit: the chain commits a quantity. Commitments are non-binding until the pool reaches its volume target. Then the chain has 48 hours to confirm.
5. Quote: when the pool reaches its volume target, the app sends one combined request for quotes to suppliers.
6. Award: the app compares the quotes (price, delivery, shortage history) and recommends a winner. Estimated savings become quoted savings.
7. Order and split: one purchase order goes to the winner. A licensed partner hub splits it per chain.

## Outputs
- Estimated price savings per chain.
- Which products each chain can save on.
- Suggested order frequency (weekly, every 2 weeks, monthly).
- A split plan per chain with savings.

## Safeguards
- No patient data in any upload.
- No chain sees another chain's prices. Only pooled totals are shared.

## Out of scope
- Payments.
- Real sign-in (demo mode only: a switcher for Chains A to E and the Pool Operator).
- Real DSCSA drug tracing.
- Pack break-down or repackaging (needs FDA registration; the licensed hub handles any splitting).

## Business model (for the pitch, not built)
Members pay a share of the savings actually realized. No supplier fees, so no conflict of interest.

## Hackathon context
Hackachusetts, Healthcare track. Must be built with Kiro. About 3 hours of build time left on the day of the event.
