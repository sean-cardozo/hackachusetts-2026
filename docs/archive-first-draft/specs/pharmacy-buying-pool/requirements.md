# Requirements Document

## Introduction

The Pharmacy Buying Pool is a web application for purchasing managers at small, independent pharmacy chains in Massachusetts. These chains sell slow-moving generic prescription drugs, and they cannot reach supplier volume tiers alone. The System lets them pool demand and follows one chain of steps:

1. **Upload**: a Buyer uploads a History File (purchases and units sold) or loads the Example Data. The System matches each line to a standard drug code (NDC).
2. **Compare**: the System compares each price paid with the Benchmark (the NADAC per-unit price), shows Weeks of Cover and shows FDA drug shortage alerts.
3. **Swap**: the System may suggest an FDA-rated Equivalent Product so that more chains can buy the same thing or so that a chain pays less.
4. **Commit**: a Buyer commits a quantity to the weekly Pool Cycle. Commitments are non-binding.
5. **Close and quote**: when the Pool Cycle closes, each Product whose pooled demand reaches its Volume Target gets one combined Request for Quotes sent to Suppliers, and a 48-hour Confirmation Window opens for the Chains. The Commitments for each Product below its Volume Target carry over to the next Pool Cycle.
6. **Award**: the System recommends the Supplier Quote with the lowest unit price for each Request for Quotes. Estimated Savings become Quoted Savings.
7. **Order and split**: one Purchase Order per awarded Supplier is issued for the confirmed quantities, and a licensed partner Hub splits the delivery per Chain according to the Split Plan. If the confirmations leave a Product below its Volume Target, the confirmed Commitments for that Product carry over to the next Pool Cycle.

**Carry-over.** A Commitment that does not lead to a Purchase Order because its Product is below the Volume Target does not expire. The System carries the Commitment over to the next Pool Cycle as a non-binding Commitment with the status "Carried over". The quantity is kept, the Commitment counts toward the next Pool Cycle's Pooled Quantity and Tier Progress, and the Buyer does not need to enter it again. A Chain can opt out in two ways: by withdrawing the Commitment at any time while a Pool Cycle is open, or by choosing "Do not carry over" during the Confirmation Window, in which case the Commitment is removed. Declined Commitments are never carried over. The System sets no limit on the number of consecutive carry-overs. The System shows the Buyer an in-app notice for each carry-over and each opt-out choice.

**Award assumption.** The System assumes that the Pool Operator only signs with reliable Suppliers, so the Award does not score reliability. The Award uses the unit price only, with one tie-break. Delivery days are shown next to each Supplier Quote for information only.

**Price labeling.** Every price shown is labeled with its source: Benchmark (real NADAC), Supplier list price (real, with source and date) or Example (made up). The Bulk Tier ladder in `/data/tiers.json` is an assumption and is labeled as Example. Supplier Quotes that are not real list prices are labeled Example.

**Privacy.** Uploads contain no patient data. No Chain sees another Chain's prices or identity, and Buyers see only pooled aggregates. In production, the goal is to show pooled aggregates only when at least 5 pharmacies contributed. The demo has exactly 5 example Chains, so that threshold is not enforced in the demo.

**Demo scope.** The System runs in demo mode only, with a switcher for Chains A to E and the Pool Operator, and with a Demo Clock that advances time so that the Friday close and the 48-hour Confirmation Window can be shown. The System does not include payments, real sign-in, DSCSA drug tracing, file downloads, or repackaging of packs (the licensed Hub handles any splitting). Stretch requirements at the end of this document add AI features, each with a plain rule-based fallback.

## Glossary

- **System**: The Pharmacy Buying Pool web application.
- **Buyer**: A user who purchases on behalf of one Chain.
- **Pool Operator**: The party that runs the Pool, sends the Request for Quotes and places the Purchase Orders.
- **Chain**: A small pharmacy chain participating in the Pool. The Example Data contains the anonymized Chains A, B, C, D and E.
- **Hub**: The licensed partner that receives the delivery of a Purchase Order and splits it per Chain according to the Split Plan.
- **Supplier**: A wholesaler or manufacturer that responds to a Request for Quotes.
- **NDC**: National Drug Code, the identifier of a drug package. The System stores every NDC as exactly 11 digits in the 5-4-2 format with no dashes.
- **NDC_Normalizer**: The System component that converts an NDC written in any supported format to the 11-digit form.
- **Catalog**: The list of Products built from the openFDA NDC Directory and the FDA Orange Book.
- **Product**: One Catalog entry identified by an 11-digit NDC, with name, labeler, strength, dosage form, Package Size and application number.
- **Package Size**: The number of units in one package of a Product, read from the openFDA packaging description.
- **Equivalent Product**: A Product with a different labeler than a reference Product, with the same ingredient, strength and dosage form and route, and with an Orange Book TE code that starts with "A".
- **Benchmark**: The NADAC (National Average Drug Acquisition Cost) per-unit price of a Product, taken from the NADAC file.
- **Supplier List Price**: A real price published by a Supplier (for example Cost Plus Drugs), stored with its source and date in `/data/supplier-prices.json`.
- **Example Price**: A price that is made up for the demo, such as a Bulk Tier price or a Supplier Quote that is not a Supplier List Price.
- **Prior Price**: The quantity-weighted average unit price a Chain paid for a Product across the matched purchase records in its History File.
- **Pool**: The shared buying program that aggregates Commitments from all Chains.
- **Pool Cycle**: A weekly period that closes every Friday at 5:00 pm America/New_York.
- **Close Date**: The date and time at which a Pool Cycle stops accepting Commitments.
- **Commitment**: A Buyer's declared quantity of a Product for the current Pool Cycle. A Commitment is non-binding until the Chain confirms it in the Confirmation Window.
- **Carried-over Commitment**: A Commitment that the System moved from a closed Pool Cycle to the next Pool Cycle, with the status "Carried over", the same quantity, and no binding obligation.
- **Carry-over**: The automatic move of a Commitment to the next Pool Cycle when its Product does not lead to a Purchase Order because the Product is below the Volume Target.
- **Do Not Carry Over**: A choice a Buyer makes during the Confirmation Window for a confirmed Commitment, which removes the Commitment instead of carrying it over.
- **Notice**: An in-app message shown to a Buyer, for example about a carry-over or an opt-out choice.
- **Backlog**: The list of Commitments held for the current Pool Cycle, including Carried-over Commitments.
- **Pooled Quantity**: The sum of the Commitment quantities of all Chains for one Product in one Pool Cycle, including Carried-over Commitments.
- **Bulk Tier**: A price level for a Product that applies when the Pooled Quantity reaches a stated threshold, defined as a percentage over or under the Benchmark in `/data/tiers.json`.
- **Base Tier**: The Bulk Tier with the lowest threshold.
- **Volume Target**: The threshold of the lowest Bulk Tier whose price is below the Base Tier price.
- **Tier Progress**: The Pooled Quantity of a Product expressed against the threshold of the next Bulk Tier.
- **History File**: A CSV file of a Chain's past purchase data.
- **History_File_Parser**: The System component that parses a History File into a list of purchase records.
- **History_File_Printer**: The System component that formats a list of purchase records into a History File.
- **Patient-Identifying Column**: A History File column whose header is, ignoring case, one of: patient name, patient id, date of birth, dob, ssn, address, phone, email, mrn, prescription number, rx number, member id.
- **Overpayment**: The positive difference between the unit price a Chain paid and the Benchmark, multiplied by the quantity purchased.
- **Weekly Need**: The units of a Product that a Chain is expected to need per Pool Cycle, equal to its average weekly units sold rounded up to the next whole number.
- **Opportunity**: A Bulk Discount savings recommendation for one Product and one Chain.
- **Savings Share**: The fixed portion of the Bulk Tier discount that the Pool passes on to the Chains, equal to 70 percent.
- **Pool Unit Price**: The unit price a Chain pays for a Product through the Pool.
- **Estimated Savings**: Savings computed from the assumed Bulk Tier ladder before quotes arrive. Estimated Savings are an assumption and are labeled as such.
- **Quoted Savings**: Savings computed from the winning Supplier Quote after the Award.
- **Request for Quotes**: One combined request, sent to Suppliers for one Product, that states the Pooled Quantity and contains no Chain identity.
- **Supplier Quote**: A Supplier's response to a Request for Quotes, with unit price, delivery days (shown for information only) and a price label.
- **Shortage Record**: One entry of the openFDA Drug Shortages feed. The System uses Shortage Records only for Shortage Alerts.
- **Shortage Alert**: A flag on a Product that has a Shortage Record with status "Current".
- **Award**: The System's recommendation of the one Supplier Quote with the lowest unit price for a Request for Quotes.
- **Confirmation Window**: The 48 hours that start at the Close Date, during which each Chain confirms or declines its Commitments.
- **Purchase Order**: The document sent to one awarded Supplier that lists the confirmed quantities per Product.
- **Split Plan**: The per-Chain allocation of the Purchase Orders of one Pool Cycle, with quantities, Pool Unit Price, cost and savings.
- **Shelf View**: A read-only table of on-hand stock, weekly use, Weeks of Cover and Expiry Alerts for a Chain's Products.
- **Weeks of Cover**: On-hand units, excluding units in expired lots, divided by average weekly units sold.
- **Expiry Alert**: A flag on a stock lot whose expiry date is from 0 to 90 days after the current Demo Clock date.
- **Suggested Order Frequency**: The recommendation to order a Product weekly, every 2 weeks or monthly.
- **Demo Mode**: The only run mode of the System, with a role switcher and no sign-in.
- **Demo Clock**: The simulated current date and time used by the System, which the user advances with a control.
- **Example Data**: The synthetic dataset of five Chains and three slow-moving generic Products, stored in `/data`.
- **AI_Service**: An external AI model that the System calls for the Stretch requirements.
- **Fallback**: The plain rule-based behavior that the System uses when an AI_Service call fails or is unavailable.

## Requirements

### Requirement 1: Onboarding

**User Story:** As a Buyer, I want to either upload my purchase history or load example data, so that I can see savings Opportunities for my Chain.

#### Acceptance Criteria

1. WHEN a Buyer starts onboarding, THE System SHALL display two selectable options, upload a History File or load the Example Data, and SHALL NOT proceed until the Buyer selects one.
2. WHEN a Buyer completes either option, THE System SHALL create a profile for the Chain and display the Opportunities for that Chain.
3. IF the History File is rejected under Requirement 2 or Requirement 21, THEN THE System SHALL keep the Buyer on the option-selection step and allow the Buyer to retry the upload or to load the Example Data.
4. IF no Opportunities exist for the Chain after onboarding completes, THEN THE System SHALL still create the Chain profile and display a message indicating that no Opportunities were found.

### Requirement 2: History File Upload and Extraction

**User Story:** As a Buyer, I want to upload my past purchase data, so that the System can analyze what I bought and what I sold.

#### Acceptance Criteria

1. WHEN a Buyer uploads a History File of up to 10 MB and up to 10,000 data rows, THE System SHALL extract for each row the product name (1 to 200 characters), quantity (whole number, 1 to 999,999), unit price (0.01 to 999,999.99), purchase date (valid calendar date, not later than the Demo Clock date), units sold (whole number, 0 to 999,999) and, where the column is present, the NDC.
2. WHEN a History File is extracted, THE System SHALL match each valid row to a Product in the Catalog and display, per row, its row number, the matched Product name (or none), the match confidence as a percentage from 0 to 100, and a status of matched or unmatched.
3. WHERE a row contains an NDC, THE System SHALL normalize the NDC with the NDC_Normalizer and match the row to the Product with that 11-digit NDC with a match confidence of 100 percent.
4. IF a History File row cannot be matched to a Product with a match confidence of at least 80 percent, or if two or more Products tie for the highest confidence of at least 80 percent, THEN THE System SHALL mark the row as unmatched and let the Buyer select a Product manually from the Catalog, and WHEN the Buyer selects a Product, THE System SHALL change the row status to matched and update the summary counts.
5. IF a History File is missing one or more required columns (product name, quantity, unit price, purchase date, units sold), THEN THE System SHALL reject the entire file, import no rows, and display an error message naming each missing column.
6. IF a History File exceeds 10 MB (10,485,760 bytes), THEN THE System SHALL reject the file before extraction, import no rows, and display an error message stating the 10 MB size limit.
7. IF a History File contains more than 10,000 data rows, THEN THE System SHALL reject the file, import no rows, and display an error message stating the 10,000 row limit.
8. IF a History File contains zero data rows or cannot be read as a History File, THEN THE System SHALL reject the file, import no rows, and display an error message indicating that the file is empty or unreadable.
9. IF a History File row contains a value that is empty or outside the ranges defined in criterion 1, THEN THE System SHALL mark the row as invalid, exclude the row from matching, display the row number and the name of each invalid field, and continue processing the remaining rows.
10. WHEN an extraction completes or the Buyer manually matches a row, THE System SHALL display a summary of rows read, rows matched, rows unmatched and rows invalid, where rows read equals rows matched plus rows unmatched plus rows invalid.
11. WHEN the History_File_Parser receives a History File, THE History_File_Parser SHALL parse the History File into a list of purchase records, one record per data row, in the same order as the rows in the file.
12. WHEN the History_File_Printer receives a list of purchase records, THE History_File_Printer SHALL format the list into a valid History File containing all required columns and one data row per record, in the same order as the list.
13. FOR ALL valid lists of purchase records, parsing, then printing, then parsing SHALL produce a list with the same number of records, in the same order, where every field (product name, quantity, unit price, purchase date, units sold) of each record equals the corresponding field in the first parsed list (round-trip property).

### Requirement 3: Public Data Catalog and Benchmark

**User Story:** As a Buyer, I want products identified by standard drug codes and compared with a government price, so that I can trust the comparisons.

#### Acceptance Criteria

1. THE System SHALL build the Catalog from the openFDA NDC Directory, with one Product per package NDC, containing the 11-digit NDC, product name, labeler name, strength, dosage form, Package Size and application number.
2. THE System SHALL read the Package Size of a Product from the leading unit count of the openFDA packaging description (for example, "100 TABLET in 1 BOTTLE" gives 100).
3. IF the packaging description of a Product has no readable unit count, THEN THE System SHALL leave the Package Size of that Product empty and label it "Package size unknown".
4. THE System SHALL join Catalog Products to FDA Orange Book entries on the application type plus application number, and SHALL group Products into one interchangeable group when the Orange Book entries share ingredient, strength and dosage form and route, and have a TE code that starts with "A".
5. THE System SHALL set the Benchmark of a Product to the NADAC per-unit price of the Product's 11-digit NDC, and SHALL display the NADAC pricing unit and the NADAC file date next to the Benchmark.
6. WHEN the NDC_Normalizer receives an NDC in the dashed 4-4-2, 5-3-2 or 5-4-1 format, THE NDC_Normalizer SHALL zero-pad the short segment to produce the 5-4-2 format and return the NDC as exactly 11 digits with no dashes.
7. WHEN the NDC_Normalizer receives an NDC that is already 11 digits with no dashes, THE NDC_Normalizer SHALL return the same 11 digits.
8. FOR ALL NDC inputs in a supported format, THE NDC_Normalizer SHALL return a string of exactly 11 digits (normalization length property).
9. FOR ALL NDC inputs in a supported format, normalizing the result of a normalization SHALL return the same result as the first normalization (idempotence property).
10. IF the NDC_Normalizer receives a value that is not in a supported format, THEN THE NDC_Normalizer SHALL return an error, and THE System SHALL exclude the affected record from the Catalog or from the matching and display the count of excluded records.
11. THE System SHALL load the Catalog, Benchmarks, Orange Book groups and Shortage Records from the generated JSON files in `/data` without a network call, and SHALL display the source and the "as of" date of each dataset.

### Requirement 4: Price Source Labels

**User Story:** As a Buyer, I want to know where every price comes from, so that I do not mistake made-up numbers for real ones.

#### Acceptance Criteria

1. THE System SHALL label every displayed Benchmark as "Benchmark (NADAC)" together with the NADAC file date.
2. THE System SHALL label every displayed Supplier List Price as "Supplier list price" together with its source name and date.
3. THE System SHALL label every displayed Bulk Tier price, and every Supplier Quote that is not a Supplier List Price, as "Example".
4. THE System SHALL label every displayed Chain-paid price as "Paid price (from your file)".
5. THE System SHALL label every Estimated Savings amount as "Estimated (assumed tier ladder)".
6. WHEN a Quoted Savings amount is based on a Supplier Quote that is not a Supplier List Price, THE System SHALL label the amount as "Quoted savings (example)".
7. WHEN a Quoted Savings amount is based on a Supplier List Price, THE System SHALL label the amount as "Quoted savings (supplier list price)" together with the source and date.
8. THE System SHALL display unit prices rounded half up to 5 decimal places and every total amount (Overpayment, cost, savings) rounded half up to the nearest cent in US dollars, with a dollar sign and thousands separators.

### Requirement 5: Benchmark Comparison and Overpayment Detection

**User Story:** As a Buyer, I want to see where I am paying more than the market, so that I know which products to move into the Pool.

#### Acceptance Criteria

1. WHEN purchase records are available for a Chain, THE System SHALL compare the paid unit price of each matched purchase record with the Benchmark of its matched Product.
2. WHEN the paid unit price of a purchase record exceeds the Benchmark, THE System SHALL calculate the Overpayment of that record as (paid unit price − Benchmark) × quantity purchased, sum the record-level Overpayments into one Overpayment per Product, and display the Overpayment per Product and as a total for the Chain, where the Chain total equals the sum of the displayed per-Product Overpayments.
3. IF the paid unit price of a purchase record is less than or equal to the Benchmark, THEN THE System SHALL count an Overpayment of $0.00 for that record.
4. THE System SHALL rank Products that have a Benchmark by Overpayment in descending order, ordering Products with equal Overpayment by Product name in ascending alphabetical order, and SHALL list a Product with a total Overpayment of $0.00 after all Products with a positive Overpayment.
5. IF no Benchmark exists for a Product, THEN THE System SHALL exclude the Product from Overpayment totals, label it "No benchmark", and list it after all Products that have a Benchmark, in ascending alphabetical order by Product name.
6. IF a purchase record cannot be matched to any Product, THEN THE System SHALL exclude the record from Overpayment calculations and display the count of unmatched records for the Chain.
7. IF no purchase records are available for a Chain, THEN THE System SHALL display a Chain total of $0.00 and a message indicating that no purchase records exist for the Chain.

### Requirement 6: Equivalent Product Swap

**User Story:** As a Buyer, I want the System to suggest an FDA-rated equivalent product, so that I can join a pool or pay less without changing the drug.

#### Acceptance Criteria

1. WHEN a Chain has a matched Product P and the Catalog contains an Equivalent Product E of P from a different labeler whose Benchmark is lower than the Benchmark of P, THE System SHALL display a swap suggestion for P naming E, the TE code, and both Benchmarks.
2. WHEN a Chain has a matched Product P, the Pooled Quantity of P comes from no other Chain, and an Equivalent Product E of P has a Pooled Quantity that comes from at least one other Chain, THE System SHALL display a swap suggestion for P naming E, the TE code, and the Pooled Quantity of E without naming any Chain.
3. THE System SHALL display each swap suggestion with the label "FDA-rated equivalent (Orange Book TE code)" and the TE code of E.
4. WHEN a Buyer accepts a swap suggestion, THE System SHALL move the Buyer's Commitment for P (if one exists) to E with the same quantity and the same status, and SHALL leave Commitments of other Chains unchanged.
5. WHEN a Buyer declines a swap suggestion, THE System SHALL remove the suggestion from the Buyer's view for the current Pool Cycle and leave all Commitments unchanged.
6. IF a Product has no Equivalent Product that meets criterion 1 or criterion 2, THEN THE System SHALL display no swap suggestion for the Product.
7. IF the Pool Cycle is closed, THEN THE System SHALL reject an attempt to accept a swap suggestion and display an error stating that the Pool Cycle is closed.

### Requirement 7: Drug Shortage Alerts

**User Story:** As a Buyer, I want to see which products have a current FDA shortage, so that I can plan around supply problems.

#### Acceptance Criteria

1. WHEN a Catalog Product has a Shortage Record with status "Current" that matches the Product by its normalized package NDC or by its normalized product NDC, THE System SHALL display a Shortage Alert on the Product wherever the Product is shown.
2. THE System SHALL display, in each Shortage Alert, the shortage status, the update date and the dosage form from the Shortage Record.
3. THE System SHALL display the Shortage Alert with the label "FDA drug shortage (openFDA)" and the "as of" date of the shortage dataset.
4. IF a Product has no Shortage Record with status "Current", THEN THE System SHALL display no Shortage Alert for the Product.

### Requirement 8: Bulk Discount Opportunities

**User Story:** As a Buyer, I want to see which products get cheaper when we buy together, so that I can commit to them.

#### Acceptance Criteria

1. WHEN at least two distinct Chains each have a Weekly Need of 1 or more units for the same Product, THE System SHALL create one Bulk Discount Opportunity for that Product for each of those Chains.
2. WHEN a Buyer views an Opportunity, THE System SHALL display the Base Tier price, the price at each Bulk Tier, the Savings Share as a percentage, the Pooled Quantity, the Volume Target, the Chain's Pool Unit Price and the Chain's Estimated Savings, each with its label from Requirement 4.
3. THE System SHALL read the Bulk Tier ladder (threshold and percentage over or under the Benchmark per tier) from `/data/tiers.json` and SHALL label the ladder as an assumption wherever Estimated Savings are shown.
4. THE System SHALL use a Savings Share of exactly 70 percent for all Opportunities.
5. THE System SHALL calculate the estimated Pool Unit Price of a Chain as the lesser of the Chain's Prior Price and the value (Bulk Tier price + (100 percent − Savings Share) × (Base Tier price − Bulk Tier price)), rounded half up to 5 decimal places, where the Bulk Tier is the highest tier whose threshold is less than or equal to the Pooled Quantity, or the Base Tier if the Pooled Quantity is 0.
6. FOR ALL Chains and Products, THE System SHALL ensure that the Pool Unit Price of the Chain is less than or equal to the Prior Price of the Chain for that Product (no-price-increase property).
7. THE System SHALL calculate the Chain's Estimated Savings as (Prior Price − estimated Pool Unit Price) × the quantity of the Chain's Commitment, or × the Chain's Weekly Need if the Chain has no Commitment, rounded half up to the nearest cent.
8. IF the Chain has no Prior Price for the Product, THEN THE System SHALL display the Estimated Savings as unavailable and display the Base Tier price as the Pool Unit Price.
9. IF the Pooled Quantity is below the Volume Target, THEN THE System SHALL display the Opportunity with the label "Volume target not yet reached" and the number of units still needed, equal to the Volume Target minus the Pooled Quantity.
10. IF a Chain's Weekly Need falls to 0 so that fewer than two distinct Chains have a Weekly Need of 1 or more for the Product, THEN THE System SHALL remove the Bulk Discount Opportunity for that Product from the Buyers' views and SHALL leave all Commitments, including Carried-over Commitments, in the Backlog unchanged.
11. WHEN a Chain has a Carried-over Commitment for the Product, THE System SHALL display the Commitment with the status "Carried over" on the Opportunity, and SHALL include the Commitment quantity in the Pooled Quantity and in the Chain's Estimated Savings calculation of criterion 7.

### Requirement 9: Suggested Order Frequency

**User Story:** As a Buyer, I want a suggestion of how often to order each product, so that I do not order too often or hold too much stock.

#### Acceptance Criteria

1. THE System SHALL calculate the average monthly units sold of a Product for a Chain as the units sold in the 90 days before the Demo Clock date divided by 3.
2. THE System SHALL calculate packages per month as the average monthly units sold divided by the Package Size.
3. WHEN packages per month is 4 or more, THE System SHALL suggest "Weekly" as the Suggested Order Frequency.
4. WHEN packages per month is 2 or more and less than 4, THE System SHALL suggest "Every 2 weeks" as the Suggested Order Frequency.
5. WHEN packages per month is greater than 0 and less than 2, THE System SHALL suggest "Monthly" as the Suggested Order Frequency.
6. IF the average monthly units sold is 0, THEN THE System SHALL display "No sales" and no Suggested Order Frequency.
7. IF the Package Size of the Product is empty, THEN THE System SHALL display "Package size unknown" and no Suggested Order Frequency.
8. FOR ALL Products, a higher average monthly units sold with the same Package Size SHALL never produce a less frequent Suggested Order Frequency (monotonicity property).

### Requirement 10: Commitment to the Pool

**User Story:** As a Buyer, I want to commit quantities to this cycle's Pool without a binding obligation, so that my demand counts toward the bulk price.

#### Acceptance Criteria

1. WHEN a Buyer selects an Opportunity and submits a quantity that is a whole number from 1 to 999,999 units, THE System SHALL record a Commitment for the Buyer's Chain in the current Pool Cycle.
2. WHEN a Commitment is recorded, THE System SHALL add the Commitment to the Backlog and show its quantity in units, its estimated Pool Unit Price and its Estimated Savings with the labels from Requirement 4, and the status "Non-binding".
3. WHILE a Pool Cycle is open, THE System SHALL let the Buyer edit the quantity of, or withdraw, any Commitment belonging to the Buyer's own Chain, and SHALL NOT offer edit or withdraw actions for Commitments belonging to other Chains.
4. IF a Buyer submits a quantity that is empty, zero, negative, fractional, non-numeric, or greater than 999,999, THEN THE System SHALL reject the Commitment, leave any existing Commitment unchanged, and display an error stating the accepted range of 1 to 999,999 whole units.
5. IF a Buyer attempts to create, edit, or withdraw a Commitment after the Close Date, THEN THE System SHALL reject the change, leave all existing Commitments unchanged, and display an error stating that the Pool Cycle is closed.
6. WHEN a Buyer opens the Backlog, THE System SHALL display every Commitment of the Buyer's own Chain in the current Pool Cycle and the total committed spend of that Chain, calculated as the sum of quantity multiplied by estimated Pool Unit Price across the Chain's Commitments, rounded half up to the nearest cent.
7. WHEN a Commitment is edited or withdrawn, THE System SHALL update the Backlog entry and the Chain's total committed spend.
8. IF recording, editing, or withdrawing a Commitment fails because of a System error, THEN THE System SHALL display an error indicating the change was not saved, leave the existing Commitments unchanged, and retain the values the Buyer entered in the form.
9. WHEN a Commitment is carried over under Requirement 12 or Requirement 14, THE System SHALL add the Commitment to the Backlog of the Buyer's Chain in the next Pool Cycle with its quantity, its estimated Pool Unit Price, its Estimated Savings, and the status "Carried over", without any action by the Buyer.
10. THE System SHALL treat a Carried-over Commitment as non-binding, and SHALL let the Buyer edit the quantity of or withdraw the Carried-over Commitment under criterion 3 while the Pool Cycle is open, where an edit keeps the status "Carried over".
11. WHEN a Buyer withdraws a Commitment while a Pool Cycle is open, THE System SHALL remove the Commitment, SHALL NOT carry the Commitment over to any later Pool Cycle, and SHALL show the Buyer a Notice that the Commitment was removed and will not be carried over.

### Requirement 11: Tier Progress Indicator

**User Story:** As a Buyer, I want to see how close each product is to its next bulk tier, so that I can decide whether to add more units.

#### Acceptance Criteria

1. THE System SHALL display Tier Progress for each Product in the current Pool Cycle as the Pooled Quantity, including the quantities of Carried-over Commitments (a whole number of 0 or more), the next Bulk Tier threshold in units, and a progress bar showing the Pooled Quantity divided by the next Bulk Tier threshold as a whole-number percentage from 0% to 100%, rounded down.
2. WHEN any Commitment is added, edited, withdrawn or carried over, THE System SHALL update the Tier Progress of the affected Product.
3. WHEN the Pooled Quantity of a Product becomes greater than or equal to a Bulk Tier threshold, THE System SHALL show the Product as having reached that tier, display that tier's price with the label "Example", and set the next Bulk Tier threshold to the next higher tier.
4. WHEN the Pooled Quantity of a Product has reached the highest Bulk Tier, THE System SHALL display the label "Top tier reached" and omit the next Bulk Tier threshold, the progress bar and the units still needed for that Product.
5. WHILE the Pooled Quantity of a Product is below the highest Bulk Tier threshold, THE System SHALL display the units still needed to reach the next Bulk Tier as a whole number of 1 or more, equal to the next Bulk Tier threshold minus the Pooled Quantity.
6. WHEN an edit or withdrawal reduces the Pooled Quantity of a Product below a Bulk Tier threshold it had reached, THE System SHALL show the highest Bulk Tier whose threshold is less than or equal to the new Pooled Quantity, or the Base Tier if no other threshold is met, and display that tier's price.
7. WHEN the Pooled Quantity of a Product reaches the Volume Target, THE System SHALL display the label "Volume target reached".
8. THE System SHALL display only the Pooled Quantity and the number of contributing Chains in Tier Progress, and SHALL NOT display any Chain name or any Chain's individual quantity to a Buyer.
9. WHEN a Pool Cycle opens with Carried-over Commitments, THE System SHALL count the quantities of the Carried-over Commitments in the Pooled Quantity and Tier Progress of the new Pool Cycle from the moment the Pool Cycle opens.

### Requirement 12: Weekly Pool Cycle and Close

**User Story:** As a Pool Operator, I want a fixed weekly cycle that closes automatically, so that the Pool follows a predictable buying rhythm.

#### Acceptance Criteria

1. THE System SHALL run one open Pool Cycle at a time, with a weekly length, and SHALL set the Close Date of each Pool Cycle to the Friday at 5:00 pm America/New_York that ends the cycle.
2. WHILE a Pool Cycle is open, THE System SHALL display to every user the Close Date and time with the America/New_York time zone indicator and the time remaining in days, hours and minutes, measured against the Demo Clock.
3. WHEN the Demo Clock reaches the Close Date, THE System SHALL lock all Commitments of the Pool Cycle so that no Commitment can be created, modified or withdrawn after the lock.
4. WHEN a Pool Cycle is locked, THE System SHALL open the next Pool Cycle with a Close Date seven days after the Close Date of the locked cycle.
5. WHEN a Pool Cycle is locked and the Pooled Quantity of a Product is greater than or equal to the Volume Target of the Product, THE System SHALL mark the Product as "Volume target reached", send one Request for Quotes for the Product under Requirement 13, and open the Confirmation Window for the Product under Requirement 14.
6. IF a Pool Cycle is locked and the Pooled Quantity of a Product is below the Volume Target, THEN THE System SHALL carry over every Commitment for that Product to the next Pool Cycle as a Carried-over Commitment with the status "Carried over", send no Request for Quotes for the Product, and show each affected Buyer a Notice stating the Product, the carried-over units, and that the Buyer can withdraw the Commitment at any time while the Pool Cycle is open.
7. IF a Pool Cycle closes with no Commitments, THEN THE System SHALL record the cycle with the status "empty", generate no Request for Quotes and no Purchase Order, and show the Pool Operator that the cycle closed empty.
8. IF the Demo Clock advances past more than one scheduled event in one step, THEN THE System SHALL process the events in chronological order.
9. FOR ALL Carried-over Commitments, the quantity of the Carried-over Commitment SHALL equal the quantity of the Commitment before the carry-over (carry-over quantity property).
10. THE System SHALL set no limit on the number of consecutive Pool Cycles through which a Commitment is carried over, so that a Commitment stays in the Pool, and is carried over again at each close, until the Product reaches the Volume Target, the Chain withdraws the Commitment, or the Chain declines the Commitment in a Confirmation Window.
11. THE System SHALL NOT carry over a Commitment that the Chain declined, and SHALL NOT carry over a Commitment that the Chain withdrew or removed with "Do not carry over".

### Requirement 13: Request for Quotes and Award

**User Story:** As a Pool Operator, I want one combined request sent to suppliers and a recommended winner, so that estimated savings turn into real quoted savings.

#### Acceptance Criteria

1. WHEN a Request for Quotes is sent for a Product, THE System SHALL create one Request for Quotes that states the Product, the Pooled Quantity, the Hub as the delivery destination and the end of the Confirmation Window as the response deadline, and that contains no Chain name and no Chain-specific quantity.
2. WHEN a Request for Quotes is created in Demo Mode, THE System SHALL load the Supplier Quotes for the Product from `/data/quotes.json` and from `/data/supplier-prices.json`, and display each Supplier Quote with the Supplier name, unit price, price label and delivery days, where the delivery days are shown for information only and do not affect the Award.
3. THE System SHALL label each Supplier Quote that comes from `/data/supplier-prices.json` as "Supplier list price" with its source and date, and each Supplier Quote that comes from `/data/quotes.json` as "Example".
4. WHEN at least one Supplier Quote exists for a Request for Quotes, THE System SHALL recommend as winner the Supplier Quote with the lowest unit price, without applying any limit on delivery days, shortage records or Shortage Alerts.
5. WHEN two or more Supplier Quotes have the same lowest unit price, THE System SHALL recommend the Supplier Quote with the fewest delivery days, and IF the delivery days are also equal, THEN THE System SHALL recommend the Supplier Quote whose Supplier name comes first in ascending alphabetical order.
6. IF no Supplier Quote exists for a Request for Quotes, THEN THE System SHALL display the message "No quotes received", keep the Estimated Savings for the Product, make no Award, and, when the Confirmation Window ends, carry over each Commitment of the Product that the Chain did not decline or remove with "Do not carry over" under Requirement 14.
7. WHEN an Award is made, THE System SHALL set the Pool Unit Price of each Chain to the lesser of the Chain's Prior Price and the unit price of the winning Supplier Quote, and SHALL replace the Estimated Savings with Quoted Savings calculated as (Prior Price − Pool Unit Price) × the quantity of the Chain's Commitment, rounded half up to the nearest cent.
8. THE System SHALL display, for each recommended winner, the reason for the Award as the winning unit price and the delivery days, together with the comparison against the other Supplier Quotes.
9. FOR ALL Chains and Products after an Award, THE System SHALL ensure that the Pool Unit Price of the Chain is less than or equal to the Prior Price of the Chain (no-price-increase property).

### Requirement 14: Confirmation Window

**User Story:** As a Buyer, I want 48 hours to confirm my commitment once the quotes are known, so that I only buy at a price I have seen.

#### Acceptance Criteria

1. WHEN the Confirmation Window opens for a Product, THE System SHALL show each Chain with a Commitment for the Product the Award, the Pool Unit Price, the Quoted Savings and the time remaining in the Confirmation Window measured against the Demo Clock.
2. WHILE the Confirmation Window is open, THE System SHALL let the Buyer confirm or decline each Commitment of the Buyer's own Chain in full, and SHALL NOT allow the Buyer to change the quantity of the Commitment.
3. WHILE the Confirmation Window is open, THE System SHALL let the Buyer change a confirm or decline response.
4. WHEN the Demo Clock reaches 48 hours after the Close Date, THE System SHALL close the Confirmation Window and treat each Commitment without a confirm response as declined.
5. WHEN the Confirmation Window closes and the sum of the confirmed Commitments for a Product is greater than or equal to the Volume Target, THE System SHALL accept the Product for a Purchase Order.
6. IF the Confirmation Window closes and the sum of the confirmed Commitments for a Product is below the Volume Target, THEN THE System SHALL accept no Purchase Order for the Product, carry over each confirmed Commitment for the Product that has no "Do not carry over" choice to the next Pool Cycle as a Carried-over Commitment with the status "Carried over", remove each confirmed Commitment that has a "Do not carry over" choice, remove each declined Commitment without carrying it over, and notify each affected Buyer that the pool fell below the Volume Target.
7. IF a Buyer attempts to confirm, decline, or choose "Do not carry over" after the Confirmation Window closes, THEN THE System SHALL reject the response and display an error stating that the Confirmation Window is closed.
8. WHILE the Confirmation Window is open, THE System SHALL let the Buyer choose "Do not carry over" for each confirmed Commitment of the Buyer's own Chain, SHALL set the default for each confirmed Commitment to carry over, and SHALL let the Buyer change the choice at any time before the Confirmation Window closes.
9. WHEN the Confirmation Window closes and a Commitment is carried over under criterion 6, THE System SHALL show the Buyer a Notice stating the Product, the carried-over units and that the Commitment can be withdrawn at any time while the Pool Cycle is open.
10. WHEN the Confirmation Window closes and a Commitment is removed because of a "Do not carry over" choice, THE System SHALL show the Buyer a Notice stating the Product, the removed units and that the Commitment was not carried over.
11. WHEN a Buyer chooses or changes "Do not carry over" for a Commitment, THE System SHALL show the Buyer a Notice stating that the Commitment will be removed instead of carried over if the Product stays below the Volume Target.
12. FOR ALL Carried-over Commitments created under criterion 6, the quantity of the Carried-over Commitment SHALL equal the quantity of the confirmed Commitment before the carry-over (carry-over quantity property).

### Requirement 15: Purchase Order Generation

**User Story:** As a Pool Operator, I want one purchase order per awarded supplier generated for the confirmed quantities, so that I can buy at the quoted price.

#### Acceptance Criteria

1. WHEN the Confirmation Window closes, THE System SHALL generate exactly one Purchase Order for each awarded Supplier that has at least one Product accepted under Requirement 14, listing for each such Product the quantity in units, the unit price of the winning Supplier Quote with its price label, and the delivery days.
2. THE System SHALL set the delivery destination of every Purchase Order to the Hub.
3. FOR ALL Products on a Purchase Order, THE System SHALL ensure that the quantity of the Product equals the sum of the confirmed Commitment quantities for the Product (purchase order quantity property).
4. IF a Confirmation Window closes and no Product is accepted, THEN THE System SHALL generate no Purchase Order and show the Pool Operator that no Purchase Order was generated.
5. IF Purchase Order generation fails, THEN THE System SHALL keep the confirmed Commitments preserved, create no partial Purchase Order, show the Pool Operator an error indicating that generation failed, and let the Pool Operator retry generation.
6. WHEN the Pool Operator views a Purchase Order, THE System SHALL display the Supplier name, the lines, and the total cost rounded half up to the nearest cent.

### Requirement 16: Split Plan and Savings per Chain

**User Story:** As a Buyer, I want to see exactly what my chain receives and how much I saved, so that I can verify the benefit of the Pool.

#### Acceptance Criteria

1. WHEN Purchase Orders are generated, THE System SHALL generate exactly one Split Plan for each Chain that has at least one confirmed Commitment of 1 or more units, and SHALL NOT generate a Split Plan for any other Chain.
2. WHEN a Buyer views the Split Plan of the Buyer's Chain, THE System SHALL list one line per confirmed Product showing the Product name, the allocated quantity in whole units, the Pool Unit Price, the line cost (allocated quantity × Pool Unit Price) and the line savings (allocated quantity × (Prior Price − Pool Unit Price)), with each line amount rounded half up to the nearest cent.
3. WHEN a Buyer views a Split Plan, THE System SHALL display the total cost (sum of all line costs) and the total savings (sum of all line savings), each with the label from Requirement 4.
4. FOR ALL Products, THE System SHALL ensure that the sum of the allocated quantities across all Split Plans equals the total confirmed quantity for the Product exactly, with zero difference (split-sum invariant).
5. FOR ALL Chains and Products, THE System SHALL ensure that the allocated units of the Chain equal the confirmed Commitment units of the Chain (allocation equals commitment property).
6. FOR ALL Chains and Products, THE System SHALL ensure that the Pool Unit Price of the Chain is less than or equal to the Prior Price of the Chain (no-price-increase property).
7. WHEN a Pool Operator opens the Split Plan comparison view, THE System SHALL display one table with one row per Chain showing the Chain name, total cost and total savings.
8. IF a Chain has no Prior Price recorded for a confirmed Product, THEN THE System SHALL show the line savings for that line as unavailable, exclude that line from the total savings, and display a notice on the Split Plan identifying the affected Product.
9. IF the sum of allocated quantities for any Product across all Split Plans does not equal the total confirmed quantity for that Product, THEN THE System SHALL NOT release any Split Plan to Buyers, SHALL preserve all existing Commitments unchanged, and SHALL display to the Pool Operator an error identifying the affected Product and the quantity difference.
10. THE System SHALL state on every Split Plan that the Hub performs any splitting of packages and that the System does not repackage products.

### Requirement 17: Shelf View

**User Story:** As a Buyer, I want to see my stock position, so that I order the right quantities and avoid expiry losses.

#### Acceptance Criteria

1. WHEN the Buyer opens the Shelf View, THE System SHALL display a read-only table with, for each Product of the Chain, the on-hand units as a whole number from 0 to 999,999, the average weekly units sold, and the Weeks of Cover.
2. THE System SHALL calculate average weekly units sold as the units sold in the 8 weeks before the Demo Clock date divided by 8, rounded half up to one decimal place.
3. THE System SHALL calculate Weeks of Cover as on-hand units, excluding units in expired lots, divided by average weekly units sold, rounded half up to one decimal place.
4. IF the average weekly units sold is zero, THEN THE System SHALL display Weeks of Cover as "No sales".
5. WHEN a stock lot has an expiry date from 0 to 90 days after the Demo Clock date, inclusive, THE System SHALL display an Expiry Alert for the lot showing the lot's expiry date and remaining units.
6. WHEN the Demo Clock date is later than a stock lot's expiry date, THE System SHALL display the lot as expired and exclude its units from Weeks of Cover.

### Requirement 18: Example Data

**User Story:** As a demo user, I want the System to start with realistic data, so that I can see every feature working without preparing files.

#### Acceptance Criteria

1. THE System SHALL include Example Data, generated into `/data` using the types in `/src/types.ts`, for exactly five anonymized Chains named A, B, C, D and E, with no real pharmacy names.
2. THE System SHALL include in the Example Data exactly three slow-moving generic Products, each with a real NDC from the Catalog and an average weekly units sold of at most 10 units per Chain.
3. THE Example Data SHALL include for each of the five Chains and each of the three Products purchase history covering at least 3 consecutive months with quantity, units sold and paid unit price, where each paid unit price equals the Benchmark × (1 + a markup from 8 to 18 percent) and a larger Chain has a smaller markup than a smaller Chain.
4. THE Example Data SHALL include for each of the five Chains and each of the three Products at least one on-hand stock lot with quantity and expiry date, and units sold per week.
5. THE Example Data SHALL include at least one Product whose Pooled Quantity from at least two Chains reaches the Volume Target, and at least one Product whose Pooled Quantity stays below the Volume Target.
6. THE Example Data SHALL include at least one stock lot with an expiry date within 90 days of the date the Example Data is loaded and at least one stock lot with an expiry date more than 90 days after that date, with expiry dates defined relative to the load date.
7. WHEN a user selects "Load example data", THE System SHALL replace all current data with the Example Data, reset the Demo Clock, and display the role switcher listing Chains A, B, C, D and E and the Pool Operator.
8. IF loading the Example Data fails, THEN THE System SHALL keep the current data unchanged and display an error message indicating that the example data could not be loaded.

### Requirement 19: Demo Mode Roles and Access

**User Story:** As a Pool Operator, I want each Buyer to see only their own Chain's data, so that pricing and stock remain confidential between competitors.

#### Acceptance Criteria

1. THE System SHALL provide a role switcher with the options Chain A, Chain B, Chain C, Chain D, Chain E and Pool Operator, and SHALL require no sign-in and no password.
2. WHILE a Buyer role is selected, THE System SHALL display only the data of the selected Chain, plus pooled totals per Product that show no Chain name, no Chain-specific price and no Chain-specific quantity.
3. WHILE the Pool Operator role is selected, THE System SHALL display the data of all Chains, the Backlog, the Requests for Quotes, the Awards, the Purchase Orders and the Split Plans, with each Chain's data attributed to its Chain name.
4. WHEN the user switches role, THE System SHALL display only the data permitted for the newly selected role.
5. IF a Buyer role requests data that belongs to another Chain, THEN THE System SHALL deny the request, display an authorization error indicating the Buyer lacks permission, return none of the other Chain's data, avoid confirming whether the requested data exists, and keep the current view unchanged.

### Requirement 20: Demo Clock

**User Story:** As a demo presenter, I want to advance time, so that the Friday close and the 48-hour Confirmation Window can be shown in a few minutes.

#### Acceptance Criteria

1. THE System SHALL display the Demo Clock date and time in the America/New_York time zone on every screen.
2. WHEN the System starts or the user selects "Load example data", THE System SHALL set the Demo Clock to the current real date and time.
3. THE System SHALL provide a Demo Clock control with the actions "Advance 1 hour", "Advance 24 hours" and "Advance to next event", where the next event is the next Close Date or the end of the next Confirmation Window.
4. WHEN the user selects an advance action, THE System SHALL move the Demo Clock forward by the stated amount and process every event that falls at or before the new Demo Clock time.
5. THE System SHALL use the Demo Clock instead of the real clock for the Close Date, the Confirmation Window, the Expiry Alert, the trailing 8-week, 90-day and 12-month periods, and the purchase date check.
6. THE System SHALL NOT move the Demo Clock backward except when the Example Data is loaded.

### Requirement 21: Privacy Safeguards

**User Story:** As a Buyer, I want my data kept private from competing chains, so that I can join the Pool without exposing my prices.

#### Acceptance Criteria

1. IF a History File contains one or more Patient-Identifying Columns, THEN THE System SHALL reject the entire file, import no rows, and display an error message naming each Patient-Identifying Column found and stating that uploads must not contain patient data.
2. THE System SHALL display a notice on the upload screen stating that uploads must contain no patient data.
3. THE System SHALL show a Buyer no other Chain's name, identity, prices, quantities or Commitments, and SHALL show only pooled aggregates (Pooled Quantity, Tier Progress, number of contributing Chains and Supplier Quotes) that identify no Chain.
4. THE System SHALL send Requests for Quotes that contain only the Product, the Pooled Quantity, the delivery destination and the response deadline.
5. THE System SHALL NOT enforce a minimum number of contributing Chains for pooled aggregates in Demo Mode.

### Requirement 22: Stretch: AI Cleaning of Messy History Files

**User Story:** As a Buyer with messy records, I want the System to clean my history file before matching, so that more of my lines match a product.

#### Acceptance Criteria

1. WHERE the AI_Service is enabled, WHEN a History File passes the checks of Requirement 2 and Requirement 21 and contains header variants, inconsistent number formats, inconsistent date formats or misspelled product names, THE System SHALL send only the five History File fields and the optional NDC field to the AI_Service and display the proposed cleaned values next to the original values.
2. WHEN the Buyer accepts the proposed cleaned values, THE System SHALL use the cleaned values for extraction and matching, and SHALL apply the validation of Requirement 2 to the cleaned values.
3. WHEN the Buyer rejects the proposed cleaned values, THE System SHALL use the original values.
4. IF the AI_Service call fails or is unavailable, THEN THE System SHALL use the Fallback, which trims whitespace, matches header names case-insensitively against a fixed alias list, removes thousands separators from numbers, parses dates in the ISO format and the US month/day/year format, and displays a notice that rule-based cleaning was used.

### Requirement 23: Stretch: AI Explanation of the Award

**User Story:** As a Pool Operator, I want a plain-language explanation of the recommended supplier, so that I can justify the choice to the Chains.

#### Acceptance Criteria

1. WHERE the AI_Service is enabled, WHEN an Award is made, THE System SHALL send the Supplier Quotes and the lowest-price winner chosen by the rule in Requirement 13 to the AI_Service and display the returned explanation.
2. THE System SHALL keep the winner chosen by the rule in Requirement 13 regardless of the text returned by the AI_Service.
3. IF the AI_Service call fails or is unavailable, THEN THE System SHALL use the Fallback, which displays a template sentence that states the winner's Supplier name, unit price and delivery days and the number of Supplier Quotes compared.

### Requirement 24: Stretch: Demand Forecast

**User Story:** As a Buyer, I want a forecast of my demand for the next weeks, so that I commit a sensible quantity.

#### Acceptance Criteria

1. WHERE the AI_Service is enabled, WHEN a Buyer opens an Opportunity, THE System SHALL display a forecast of the units the Chain will sell in each of the next 4 weeks, as whole numbers of 0 or more, labeled "Forecast (AI estimate)".
2. IF the AI_Service call fails, is unavailable, or returns a value that is not a whole number of 0 or more, THEN THE System SHALL use the Fallback, which forecasts each of the next 4 weeks as the average weekly units sold from Requirement 17 rounded half up to a whole number, labeled "Forecast (average of last 8 weeks)".
3. THE System SHALL show the forecast as information only and SHALL NOT create or change any Commitment from the forecast.

### Requirement 25: Stretch: Questions About the Owner's Own Data

**User Story:** As a Buyer, I want to ask questions about my own data in plain language, so that I get answers without reading every table.

#### Acceptance Criteria

1. WHERE the AI_Service is enabled, WHEN a Buyer submits a question, THE System SHALL send the question together with only the selected Chain's data and the pooled aggregates to the AI_Service and display the returned answer.
2. IF a Buyer asks about another Chain's data, THEN THE System SHALL decline to answer and display a message that only the Buyer's own Chain data and pooled totals are available.
3. IF the AI_Service call fails or is unavailable, THEN THE System SHALL use the Fallback, which displays a fixed list of questions (top Overpayments, Weeks of Cover per Product, lots with an Expiry Alert, time until the Close Date, and Commitments of the Chain) and answers the selected question from the Chain's data with rule-based logic.
