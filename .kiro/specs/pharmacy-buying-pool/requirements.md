# Requirements Document

## Introduction

The Pharmacy Buying Pool is a web application that lets small pharmacy chains buy together on a recurring cycle. Each Buyer first onboards by uploading past purchase and transaction data or by answering a short questionnaire. The System compares the Buyer's prices against benchmarks and flags products the Buyer over-purchases because of fixed supplier package sizes. The System then presents savings opportunities in two scenarios:

1. **Bulk discount**: demand from several chains for the same product is aggregated to reach a supplier price tier, and part of the discount is passed on to the chains.
2. **Pack break-down**: when a supplier sells only in multi-unit packs (for example 12-packs), the Pool Operator buys the full pack and resells single units or small quantities to each chain. This frees working capital that would otherwise be tied up in surplus stock.

Buyers commit quantities to the current Pool Cycle, and each commitment is held in a backlog. When the cycle closes, the System aggregates all commitments into one supplier Purchase Order and produces a Split Plan per chain that shows savings. A Shelf View shows on-hand stock, weeks of cover and expiry alerts. The System ships with example data for five chains (A to E) and three slow-moving generic products.

## Glossary

- **System**: The Pharmacy Buying Pool web application.
- **Buyer**: A user who purchases on behalf of one Chain.
- **Pool Operator**: The party that runs the Pool, negotiates with the Supplier, and places the Purchase Order.
- **Chain**: A small pharmacy chain participating in the Pool. The example data contains Chains A, B, C, D and E.
- **Supplier**: A wholesaler that sells products to the Pool Operator in fixed Pack Sizes and Bulk Tiers.
- **Product**: A pharmacy item identified by a catalog entry with name, strength, form, Pack Size and Supplier price tiers.
- **Pack Size**: The number of units in the smallest package the Supplier sells.
- **Pool**: The shared buying program that aggregates commitments from all Chains.
- **Pool Cycle**: A recurring period with an open date and a Close Date. The cycle length is configurable (for example weekly or monthly).
- **Close Date**: The date and time at which a Pool Cycle stops accepting commitments and the System generates the Purchase Order.
- **Commitment**: A Buyer's declared quantity of a Product for the current Pool Cycle.
- **Backlog**: The list of Commitments held for a Pool Cycle until its Close Date.
- **Bulk Tier**: A Supplier price level that applies when the total pooled quantity of a Product reaches a stated threshold.
- **Tier Progress**: The pooled quantity of a Product expressed against the threshold of the next Bulk Tier.
- **Benchmark**: A reference unit price for a Product against which a Buyer's paid price is compared.
- **Overpayment**: The positive difference between the unit price a Chain paid and the Benchmark, multiplied by the quantity purchased.
- **Over-purchase**: A purchase where the quantity bought in a period exceeds the quantity sold or consumed in that period because of the Pack Size.
- **Questionnaire**: A short set of questions that a Buyer answers instead of uploading history.
- **History File**: A CSV file of a Chain's past purchase and transaction data.
- **Reorder List**: A CSV file of products a Buyer wants to reorder.
- **Opportunity**: A savings recommendation for one Product and one Chain, of type Bulk Discount or Pack Break-down.
- **Savings Share**: The portion of the negotiated Supplier discount that the Pool Operator passes on to the Chains.
- **Purchase Order**: The single document sent to the Supplier at Close Date that lists aggregated quantities per Product.
- **Split Plan**: The per-Chain allocation of a Purchase Order, listing quantities, unit price, cost and savings.
- **Shelf View**: A screen that lists on-hand stock, weeks of cover and expiry alerts for a Chain's Products.
- **Weeks of Cover**: On-hand units divided by average weekly units sold.
- **Expiry Alert**: A flag on a stock lot whose expiry date falls within the configured alert window.
- **Working Capital Freed**: The difference between the cost of the minimum Supplier pack and the cost of the units a Chain actually buys.
- **Example Data**: The seeded dataset of five Chains and three slow-moving generic Products.

## Requirements

### Requirement 1: Onboarding Path Selection

**User Story:** As a Buyer, I want to choose between uploading my past data and answering a few questions, so that I can start using the Pool with the effort I can afford.

#### Acceptance Criteria

1. WHEN a Buyer starts onboarding, THE System SHALL display two selectable options, upload a History File or answer the Questionnaire, within 2 seconds, and SHALL NOT proceed until the Buyer selects one.
2. WHEN a Buyer completes either option, THE System SHALL create a profile for the Chain and display the Opportunities for that Chain within 10 seconds of completion.
3. WHEN a Buyer who completed onboarding by Questionnaire uploads a History File, THE System SHALL recompute the Opportunities for that Chain using the History File data and replace the previously displayed Opportunities within 10 seconds of upload completion.
4. IF a Buyer leaves onboarding before completion, THEN THE System SHALL retain all entered answers for 30 days and, on the Buyer's next visit within that period, resume at the first incomplete step with previously entered answers pre-filled.
5. IF a Buyer's History File has an unsupported format, is empty, exceeds 10 MB, or contains zero valid records, THEN THE System SHALL reject the file, display an error message indicating which of these reasons applies, keep the Buyer on the option-selection step, and allow the Buyer to retry the upload or switch to the Questionnaire without losing previously entered answers.
6. IF a Buyer submits the Questionnaire with a required question unanswered or an answer outside its allowed values, THEN THE System SHALL block submission, indicate each affected question with an error message, and retain all other entered answers.
7. IF no Opportunities exist for the Chain after onboarding completes, THEN THE System SHALL still create the Chain profile and display a message indicating that no Opportunities were found, together with an option to upload a History File if the Buyer completed the Questionnaire.

### Requirement 2: History File Upload and Extraction

**User Story:** As a Buyer, I want to upload my past purchase and transaction data, so that the System can analyze what I bought and what I sold.

#### Acceptance Criteria

1. WHEN a Buyer uploads a History File of up to 10 MB and up to 10,000 data rows, THE System SHALL extract for each row the product name (1 to 200 characters), quantity (whole number, 1 to 999,999), unit price (0.01 to 999,999.99), purchase date (valid calendar date, not later than the upload date) and units sold (whole number, 0 to 999,999), and SHALL complete extraction and matching within 30 seconds.
2. WHEN a History File is extracted, THE System SHALL match each valid row to a Product in the catalog and display, per row, its row number, the matched Product name (or none), the match confidence as a percentage from 0 to 100, and a status of matched or unmatched.
3. IF a History File row cannot be matched to a Product with a match confidence of at least 80 percent, or if two or more Products tie for the highest confidence of at least 80 percent, THEN THE System SHALL mark the row as unmatched and let the Buyer select a Product manually from the catalog, and WHEN the Buyer selects a Product, THE System SHALL change the row status to matched and update the summary counts.
4. IF a History File is missing one or more required columns (product name, quantity, unit price, purchase date, units sold), THEN THE System SHALL reject the entire file, import no rows, and display an error message naming each missing column.
5. IF a History File exceeds 10 MB (10,485,760 bytes), THEN THE System SHALL reject the file before extraction, import no rows, and display an error message stating the 10 MB size limit.
6. WHEN an extraction completes or the Buyer manually matches a row, THE System SHALL display a summary of rows read, rows matched, rows unmatched and rows invalid, where rows read equals rows matched plus rows unmatched plus rows invalid.
7. WHEN the History_File_Parser receives a History File, THE History_File_Parser SHALL parse it into a list of purchase records, one record per data row, in the same order as the rows in the file.
8. WHEN the History_File_Printer receives a list of purchase records, THE History_File_Printer SHALL format it into a valid History File containing all required columns and one data row per record, in the same order as the list.
9. FOR ALL valid lists of purchase records, parsing, then printing, then parsing SHALL produce a list with the same number of records, in the same order, where every field (product name, quantity, unit price, purchase date, units sold) of each record equals the corresponding field in the first parsed list (round-trip property).
10. IF a History File row contains a value that is empty or outside the ranges defined in criterion 1, THEN THE System SHALL mark the row as invalid, exclude it from matching, display the row number and the name of each invalid field, and continue processing the remaining rows.
11. IF a History File contains zero data rows or cannot be read as a History File, THEN THE System SHALL reject the file, import no rows, and display an error message indicating that the file is empty or unreadable.
12. IF a History File contains more than 10,000 data rows, THEN THE System SHALL reject the file, import no rows, and display an error message stating the 10,000 row limit.

### Requirement 3: Questionnaire Onboarding

**User Story:** As a Buyer without clean digital records, I want to answer a few questions, so that I can see Opportunities without preparing a file.

#### Acceptance Criteria

1. THE System SHALL present a Questionnaire of no more than 8 questions, with every question visible on the Questionnaire screen before submission.
2. THE Questionnaire SHALL collect, for each of 1 to 5 products the Buyer lists as top products by spend, the product name (1 to 100 characters), the typical monthly quantity (a number from 1 to 999,999 units), the unit price usually paid (a number from 0.01 to 999,999.99 in US dollars), and the current Supplier name (1 to 100 characters).
3. WHEN a Buyer submits a valid Questionnaire, THE System SHALL convert each listed product's answers into one purchase record and make the records available for benchmark comparison within 3 seconds.
4. IF a Questionnaire answer is missing, outside the ranges in criterion 2, or not in the expected format, THEN THE System SHALL keep the Buyer on the Questionnaire screen, visually highlight each affected question, show a message beside each highlighted question stating whether the answer is missing or invalid, and retain all other answers the Buyer entered.
5. WHERE the Questionnaire is the only onboarding input the Buyer has provided (no uploaded purchase file), THE System SHALL display an "estimated" label on every Opportunity generated from the Questionnaire records.
6. IF the System fails to convert the answers into purchase records, THEN THE System SHALL keep the Buyer on the Questionnaire screen, display an error message stating that the submission could not be processed and can be retried, and retain all entered answers.

### Requirement 4: Benchmark Matching and Overpayment Detection

**User Story:** As a Buyer, I want to see where I am paying more than the market, so that I know which products to move into the Pool.

#### Acceptance Criteria

1. WHEN purchase records are available for a Chain, THE System SHALL compare the paid unit price of each purchase record against the Benchmark of its matched Product and complete the comparison for up to 10,000 purchase records within 2 seconds.
2. WHEN the paid unit price of a purchase record exceeds the Benchmark, THE System SHALL calculate the Overpayment of that record as (paid unit price − Benchmark) × quantity purchased, sum the record-level Overpayments into one Overpayment per Product, and display it per Product and as a total for the Chain, where the Chain total equals the sum of the displayed per-Product Overpayments.
3. THE System SHALL display every Overpayment in US dollars with a dollar sign, thousands separators, and exactly two decimal places (for example, $1,234.50), rounded half up to the nearest cent.
4. IF no Benchmark exists for a Product, THEN THE System SHALL exclude the Product from Overpayment totals, label it "No benchmark", and list it after all Products that have a Benchmark, in ascending alphabetical order by Product name.
5. THE System SHALL rank Products that have a Benchmark by Overpayment in descending order, and order Products with equal Overpayment in ascending alphabetical order by Product name.
6. IF the paid unit price of a purchase record is less than or equal to the Benchmark, THEN THE System SHALL count an Overpayment of $0.00 for that record, and SHALL display a Product whose total Overpayment is $0.00 as "$0.00" at the bottom of the ranked Products that have a Benchmark.
7. IF a purchase record cannot be matched to any Product, THEN THE System SHALL exclude the record from Overpayment calculations and display the count of unmatched records for the Chain.
8. IF no purchase records are available for a Chain, THEN THE System SHALL display a Chain total of $0.00 and a message indicating that no purchase records exist for the Chain.

### Requirement 5: Over-purchase Detection from Pack Size

**User Story:** As a Buyer, I want to see which products I buy in larger packs than I sell, so that I can stop tying up cash in surplus stock.

#### Acceptance Criteria

1. WHEN purchase records contain units sold, THE System SHALL compare units purchased with units sold for each Product for each calendar month.
2. WHEN, for a Product in a calendar month, units purchased exceed units sold, the Pack Size is greater than 1, and units purchased do not exceed the smallest whole number of packs that covers units sold (with a minimum of 1 pack) multiplied by the Pack Size, THE System SHALL flag the Product for that month as an Over-purchase.
3. WHEN a Product is flagged as an Over-purchase, THE System SHALL display the Product name, the calendar month, units purchased, units sold, Pack Size, surplus units and surplus cost in the same row, with surplus cost shown in currency with 2 decimal places.
4. THE System SHALL calculate surplus units as units purchased minus units sold, and surplus cost as surplus units multiplied by the paid unit price, where the paid unit price is the total amount paid for the Product in that month divided by units purchased in that month.
5. THE System SHALL rank Over-purchases by surplus cost in descending order, using Product name in ascending alphabetical order to order entries with equal surplus cost.
6. IF a Product has no units sold value or no Pack Size value for a calendar month, THEN THE System SHALL exclude that Product-month from Over-purchase detection and display an indication that it was excluded and which value is missing.
7. IF no Product-month is flagged as an Over-purchase, THEN THE System SHALL display a message indicating that no Over-purchases were found.

### Requirement 6: Bulk Discount Opportunities

**User Story:** As a Buyer, I want to see which products get cheaper when we buy together, so that I can commit to them.

#### Acceptance Criteria

1. WHEN at least two distinct Chains have each submitted a need with quantity of 1 or more units for the same Product in the same Pool Cycle, THE System SHALL create one Bulk Discount Opportunity for that Product.
2. WHEN a Buyer views a Bulk Discount Opportunity, THE System SHALL display the current Supplier price per unit, the price per unit at each Bulk Tier, the Savings Share as a percentage, the pooled quantity, and the Chain's estimated savings, with all monetary values shown in US dollars to 2 decimal places.
3. THE System SHALL calculate the Chain's price per unit as the Bulk Tier price plus (100 percent minus the Savings Share) multiplied by the tier discount per unit, where the tier discount per unit is the current Supplier price minus the Bulk Tier price, and where the Bulk Tier is the highest tier whose threshold is less than or equal to the pooled quantity, rounded half-up to 2 decimal places.
4. THE System SHALL calculate the Chain's estimated savings as the current Supplier price minus the Chain's price per unit, multiplied by the quantity the Chain needs, rounded half-up to 2 decimal places.
5. WHERE the Pool Operator configures a Savings Share, THE System SHALL apply the configured percentage to all Bulk Discount Opportunities.
6. IF no Savings Share has been configured, THEN THE System SHALL use a Savings Share of 70 percent.
7. IF the Pool Operator enters a Savings Share that is not a whole number from 0 to 100 inclusive, THEN THE System SHALL reject the value, display an error message indicating the allowed range, and retain the previously configured Savings Share.
8. IF the pooled quantity is below the first Bulk Tier threshold, THEN THE System SHALL display the Opportunity with the label "Tier not yet reached" and the number of units still needed, calculated as the first Bulk Tier threshold minus the pooled quantity.
9. IF a Chain withdraws its need so that fewer than two distinct Chains need the Product, THEN THE System SHALL remove the Bulk Discount Opportunity for that Product from the Buyer's view.

### Requirement 7: Pack Break-down Opportunities

**User Story:** As a Buyer, I want to buy just the units I need from a large supplier pack, so that I do not waste cash on surplus stock.

#### Acceptance Criteria

1. WHEN a Chain's total requested units for a Product in the current Pool Cycle is at least 1 and less than the Product's Pack Size, and the Pack Size is an integer greater than 1, THE System SHALL create one Pack Break-down Opportunity for that Chain and Product within 5 seconds.
2. WHILE a Pack Break-down Opportunity is open, THE System SHALL display the units the Chain needs, the Pack Size, the cost of buying the full pack, the cost of buying only the needed units, and the Working Capital Freed. Costs SHALL be shown in US dollars to 2 decimal places. The Working Capital Freed SHALL equal the cost of the full pack minus the cost of the needed units.
3. WHEN the pooled demand for a Product across all Chains in the current Pool Cycle reaches at least one full Pack Size, THE System SHALL mark the Pack Break-down Opportunity as fulfillable within 5 seconds.
4. WHEN the Close Date is reached and the pooled demand for a Product is at least one Pack Size but is not a multiple of the Pack Size, THE System SHALL round the Supplier order up to the next whole number of full packs. THE System SHALL record the remaining units (Supplier order units minus pooled demand) as Pool Operator inventory.
5. WHEN the System prices a single unit sold to a Chain from a broken-down pack, THE System SHALL set the unit price to (Supplier pack price ÷ Pack Size) + break-down fee, rounded half-up to 2 decimal places. The break-down fee is a per-unit amount configured by the Pool Operator.
6. IF the pooled demand for a Product is below one Pack Size at the Close Date, THEN THE System SHALL carry the affected Commitments over unchanged to the next Pool Cycle. THE System SHALL notify each affected Buyer within 60 seconds. The notification SHALL state the Product, the Buyer's committed units, and that the Commitment was carried over.
7. IF the Pool Operator submits a break-down fee that is negative, non-numeric, or has more than 2 decimal places, THEN THE System SHALL reject the value, show an error indicating the fee is invalid, and keep the previously configured fee.

### Requirement 8: Reorder List Upload and Product Matching

**User Story:** As a Buyer, I want to upload a reorder list, so that I can commit to many products without typing each one.

#### Acceptance Criteria

1. WHEN a Buyer uploads a Reorder List of 1 to 500 lines and no larger than 5 MB, THE System SHALL match each line to a Product in the catalog and display the match results within 10 seconds.
2. THE System SHALL display each matched line with the Product name, strength, form, Pack Size, requested quantity, and the matching confidence as a whole-number percentage from 0 to 100.
3. IF a Reorder List line cannot be matched with a confidence of at least 80 percent, THEN THE System SHALL list the line as unmatched, exclude it from the draft Commitments, and let the Buyer choose a Product from the catalog or remove the line.
4. IF a Reorder List line contains a quantity that is not a whole number from 1 to 999,999, THEN THE System SHALL reject that line, display the line number with a message indicating the quantity is invalid, and continue processing the remaining lines.
5. WHEN the Buyer confirms matched lines, THE System SHALL add one draft Commitment per matched line, with the matched Product and the requested quantity, and SHALL exclude unmatched and rejected lines.
6. WHEN the Reorder_List_Parser receives a Reorder List, THE Reorder_List_Parser SHALL parse it into an ordered list of reorder lines, each containing a product description and a quantity.
7. WHEN the Reorder_List_Printer receives a list of reorder lines, THE Reorder_List_Printer SHALL format it into a valid Reorder List that preserves line order, product descriptions and quantities.
8. FOR ALL valid lists of reorder lines, parsing, then printing, then parsing SHALL produce a list equivalent to the first parsed list, meaning the same number of lines in the same order with identical product descriptions and quantities (round-trip property).
9. IF an uploaded Reorder List is empty, has more than 500 lines, is larger than 5 MB, or cannot be read, THEN THE System SHALL reject the whole upload, display an error message indicating which condition failed, and create no draft Commitments.
10. IF adding confirmed lines to the Buyer's draft Commitments fails, THEN THE System SHALL add none of the confirmed lines, keep the Buyer's existing draft Commitments unchanged, keep the match results on screen, and display an error message indicating the lines were not added.

### Requirement 9: Pool Cycle Configuration

**User Story:** As a Pool Operator, I want to set the length and Close Date of the Pool Cycle, so that the Pool fits the buying rhythm of the Chains.

#### Acceptance Criteria

1. THE System SHALL let the Pool Operator set the Pool Cycle length to exactly one of two values: weekly (7 calendar days) or monthly (one calendar month, ending on the same day of the month as the cycle start, or on the last day of the month if that day does not exist).
2. THE System SHALL let the Pool Operator set the Close Date and time for the current Pool Cycle, with a date and a time of day at one-minute resolution.
3. WHILE a Pool Cycle is open, THE System SHALL display to every Buyer the Close Date and time with a time zone indicator, and the time remaining in days, hours, and minutes, refreshed at least every 60 seconds.
4. IF the Pool Operator sets a Close Date and time that is earlier than or equal to the current time, THEN THE System SHALL reject the value, show the Pool Operator an error message indicating the Close Date must be in the future, and keep the previous Close Date unchanged.
5. WHEN a Pool Cycle closes, THE System SHALL open the next Pool Cycle within 60 seconds of the Close Date and time, with a Close Date equal to the closed cycle's Close Date plus the configured cycle length.
6. WHEN the Pool Operator saves a valid new Close Date for an open Pool Cycle, THE System SHALL show the new Close Date and time remaining to every Buyer within 60 seconds.
7. WHEN the Pool Operator changes the Pool Cycle length while a Pool Cycle is open, THE System SHALL keep the current Pool Cycle's Close Date unchanged and apply the new length starting with the next Pool Cycle.

### Requirement 10: Commitment to the Pool

**User Story:** As a Buyer, I want to commit quantities to this cycle's Pool, so that my demand counts toward the bulk price.

#### Acceptance Criteria

1. WHEN a Buyer selects an Opportunity and submits a quantity that is a whole number from 1 to 999,999 units, THE System SHALL record a Commitment for the Buyer's Chain in the current Pool Cycle within 2 seconds.
2. WHEN a Commitment is recorded, THE System SHALL add the Commitment to the Backlog within 2 seconds and show its quantity in units, its estimated unit price as a currency amount with 2 decimal places, and its estimated savings as a currency amount with 2 decimal places.
3. WHILE a Pool Cycle is open, THE System SHALL let the Buyer edit the quantity of, or withdraw, any Commitment belonging to the Buyer's own Chain, and SHALL NOT offer edit or withdraw actions for Commitments belonging to other Chains.
4. IF a Buyer submits a quantity that is empty, zero, negative, fractional, non-numeric, or greater than 999,999, THEN THE System SHALL reject the Commitment, leave any existing Commitment unchanged, and display an error stating the accepted range of 1 to 999,999 whole units.
5. IF a Buyer attempts to create, edit, or withdraw a Commitment after the Close Date, THEN THE System SHALL reject the change, leave all existing Commitments unchanged, and display an error stating that the Pool Cycle is closed.
6. WHEN a Buyer opens the Backlog, THE System SHALL display every Commitment in the current Pool Cycle and a total committed spend per Chain, calculated as the sum of quantity multiplied by estimated unit price across that Chain's Commitments, shown as a currency amount with 2 decimal places.
7. WHEN a Commitment is edited or withdrawn, THE System SHALL update the Backlog entry and the Chain's total committed spend within 2 seconds.
8. IF recording, editing, or withdrawing a Commitment fails because of a System error, THEN THE System SHALL display an error indicating the change was not saved, leave the existing Commitments unchanged, and retain the values the Buyer entered in the form.

### Requirement 11: Tier Progress Indicator

**User Story:** As a Buyer, I want to see how close each product is to its next bulk tier, so that I can decide whether to add more units.

#### Acceptance Criteria

1. THE System SHALL display Tier Progress for each Product in the current Pool Cycle as the pooled units (a whole number of 0 or more), the next Bulk Tier threshold in units, and a progress bar showing pooled units divided by the next Bulk Tier threshold as a whole-number percentage from 0% to 100%, rounded down.
2. WHEN any Commitment is added, edited or withdrawn, THE System SHALL update the Tier Progress of the affected Product within 2 seconds of the change being saved.
3. WHEN the pooled quantity of a Product becomes greater than or equal to a Bulk Tier threshold, THE System SHALL show the Product as having reached that tier, display that tier's unit price, and set the next Bulk Tier threshold to the next higher tier.
4. WHEN the pooled quantity of a Product has reached the highest Bulk Tier, THE System SHALL display the label "Top tier reached" and omit the next Bulk Tier threshold, the progress bar and the units still needed for that Product.
5. WHILE the pooled quantity of a Product is below the highest Bulk Tier threshold, THE System SHALL display the units still needed to reach the next Bulk Tier as a whole number of 1 or more, equal to the next Bulk Tier threshold minus the pooled units.
6. WHEN an edit or withdrawal reduces the pooled quantity of a Product below a Bulk Tier threshold it had reached, THE System SHALL show the highest Bulk Tier whose threshold is less than or equal to the new pooled quantity and display that tier's unit price, or the base unit price if no Bulk Tier threshold is met, within 2 seconds of the change being saved.
7. IF the Tier Progress of a Product cannot be updated within 2 seconds of a saved Commitment change, THEN THE System SHALL keep displaying the last known Tier Progress values and show an indicator that the values may be outdated until the update succeeds.

### Requirement 12: Pool Close and Purchase Order Generation

**User Story:** As a Pool Operator, I want one supplier order generated automatically at Close Date, so that I can buy at the pooled price.

#### Acceptance Criteria

1. WHEN the Close Date of a Pool Cycle is reached, THE System SHALL lock all Commitments for the Pool Cycle so that no Commitment can be created, modified, or cancelled after the lock.
2. WHEN the Pool Cycle is locked and contains at least one Commitment, THE System SHALL generate exactly one Purchase Order for the Pool Cycle that lists, for each Product, the aggregated quantity in units, the Pack count, the applied Bulk Tier, and the unit price.
3. WHEN the Close Date of a Pool Cycle is reached, THE System SHALL complete the lock and generate the Purchase Order within 30 seconds.
4. WHEN the Purchase Order is generated, THE System SHALL set the quantity of each Product in the Purchase Order equal to the sum of that Product's locked Commitment quantities plus any units rounded up under Requirement 7.
5. WHEN the Pool Operator requests a download of a Purchase Order, THE System SHALL provide a CSV file containing one row per Product with the same quantity, Pack count, Bulk Tier, and unit price values shown in the Purchase Order.
6. IF a Pool Cycle closes with no Commitments, THEN THE System SHALL record the cycle with the status "empty", generate no Purchase Order, and show the Pool Operator that the cycle closed empty.
7. IF a user attempts to create, modify, or cancel a Commitment after the Pool Cycle is locked, THEN THE System SHALL reject the request, leave the locked Commitments unchanged, and show the user an error indicating that the Pool Cycle is closed.
8. IF Purchase Order generation fails, THEN THE System SHALL keep the Pool Cycle locked with all Commitments preserved, create no partial Purchase Order, show the Pool Operator an error indicating that generation failed, and let the Pool Operator retry generation.

### Requirement 13: Split Plan and Savings per Chain

**User Story:** As a Buyer, I want to see exactly what my chain receives and how much I saved, so that I can verify the benefit of the Pool.

#### Acceptance Criteria

1. WHEN a Purchase Order is generated, THE System SHALL generate exactly one Split Plan for each Chain that has at least one Commitment with a quantity of 1 or more, and SHALL NOT generate a Split Plan for any Chain that has no such Commitment.
2. WHEN a Buyer views the Split Plan of the Buyer's Chain, THE System SHALL list one line per committed Product showing the Product name, the allocated quantity in whole units, the Pool unit price, the line cost (allocated quantity × Pool unit price) and the line savings (allocated quantity × (the Chain's prior unit price − Pool unit price)), with all monetary values rounded to two decimal places.
3. WHEN a Buyer views a Split Plan, THE System SHALL display the total cost (sum of all line costs), the total savings (sum of all line savings) and the Working Capital Freed for that Chain, with all monetary values rounded to two decimal places, within 2 seconds of the request.
4. WHEN a Purchase Order is generated, THE System SHALL ensure that, for each Product, the sum of the allocated quantities across all Split Plans equals the total committed quantity for that Product exactly, with zero difference.
5. WHEN a Buyer requests a CSV download of the Buyer's Chain's Split Plan, THE System SHALL provide, within 5 seconds, a CSV file containing a header row and one row per Split Plan line with the same fields listed in criterion 2, and SHALL NOT include data from any other Chain.
6. WHEN a Pool Operator opens the Split Plan comparison view, THE System SHALL display a single table with one row per Chain (up to 50 Chains) showing the Chain name, total cost, total savings and Working Capital Freed, within 2 seconds of the request.
7. IF a Chain has no prior unit price recorded for a committed Product, THEN THE System SHALL show the line savings for that line as unavailable, SHALL exclude that line from the total savings, and SHALL display a notice on the Split Plan identifying the affected Product.
8. IF the sum of allocated quantities for any Product across all Split Plans does not equal the total committed quantity for that Product, THEN THE System SHALL NOT release any Split Plan to Buyers, SHALL preserve all existing Commitments unchanged, and SHALL display to the Pool Operator an error identifying the affected Product and the quantity difference.
9. IF the CSV file cannot be generated, THEN THE System SHALL NOT deliver a partial file, SHALL display an error message to the Buyer indicating that the download failed, and SHALL leave the Split Plan on screen unchanged.

### Requirement 14: Shelf View

**User Story:** As a Buyer, I want to see my stock position, so that I order the right quantities and avoid expiry losses.

#### Acceptance Criteria

1. WHEN the Buyer opens the Shelf View, THE System SHALL display, for each Product of the Chain, the on-hand units as a whole number from 0 to 999,999, the average weekly units sold, and the Weeks of Cover.
2. THE System SHALL calculate average weekly units sold as total units sold in the trailing 8 weeks divided by 8, rounded to one decimal place.
3. THE System SHALL calculate Weeks of Cover as on-hand units, excluding units in expired lots, divided by average weekly units sold, rounded to one decimal place.
4. IF the average weekly units sold is zero, THEN THE System SHALL display Weeks of Cover as "No sales" and SHALL NOT flag the Product as overstocked.
5. WHEN a stock lot has an expiry date from 0 to 90 days after the current date, inclusive, THE System SHALL display an Expiry Alert for the lot showing the lot's expiry date and remaining units.
6. WHERE the Buyer configures an alert window of 1 to 365 whole days, THE System SHALL use the configured number of days instead of 90 days for the Expiry Alert.
7. IF the Buyer enters an alert window that is not a whole number from 1 to 365, THEN THE System SHALL reject the value, display an error message indicating the allowed range, and keep the previously saved alert window.
8. WHEN the current date is later than a stock lot's expiry date, THE System SHALL display the lot as expired and exclude its units from Weeks of Cover.
9. WHEN a Product has Weeks of Cover above 12.0 weeks, THE System SHALL flag the Product as overstocked and display a visible warning on the Product that new Commitments are discouraged, while still allowing the Buyer to create a Commitment.

### Requirement 15: Example Data

**User Story:** As a demo user, I want the System to start with realistic data, so that I can see every feature working without preparing files.

#### Acceptance Criteria

1. THE System SHALL include Example Data for exactly five Chains named A, B, C, D and E.
2. THE System SHALL include in the Example Data exactly three slow-moving generic Products, where each Product has a Pack Size greater than 1, an average weekly units sold of at most 10 units per Chain, and at least two Bulk Tiers with thresholds in ascending order and unit prices in descending order.
3. THE Example Data SHALL include for each of the five Chains and each of the three Products: purchase history covering at least 3 consecutive months with units purchased, units sold and paid unit price per month; at least one on-hand stock lot with quantity and expiry date; and an average weekly units sold value greater than or equal to 0.
4. THE Example Data SHALL include at least one Product whose pooled demand from at least two Chains is greater than or equal to the first Bulk Tier threshold, and at least one Product whose pooled demand is below the first Bulk Tier threshold.
5. THE Example Data SHALL include at least one Chain and Product combination in which units purchased exceed units sold in at least one month because purchases are made in multiples of the Pack Size.
6. THE Example Data SHALL include at least one stock lot with an expiry date within 90 days of the date the Example Data is loaded and at least one stock lot with an expiry date more than 90 days after that date, with expiry dates defined relative to the load date.
7. WHEN a user selects "Load example data", THE System SHALL replace all current data with the Example Data and display the Chain selector listing Chains A, B, C, D and E within 2 seconds.
8. IF loading the Example Data fails, THEN THE System SHALL keep the current data unchanged and display an error message indicating that the example data could not be loaded.

### Requirement 16: Roles and Access

**User Story:** As a Pool Operator, I want each Buyer to see only their own Chain's data, so that pricing and stock remain confidential between competitors.

#### Acceptance Criteria

1. WHEN a user who is not signed in requests any Chain data, THE System SHALL withhold all Chain data and present the sign-in screen.
2. WHILE a Buyer is signed in, THE System SHALL display only the data of the Buyer's own Chain, plus pooled totals per Product that show no Chain name, Chain-specific price or Chain-specific quantity.
3. WHILE a Pool Operator is signed in, THE System SHALL display the data of all Chains, the Backlog, Purchase Orders and Split Plans, with each Chain's data attributed to its Chain name.
4. IF a Buyer requests data that belongs to another Chain, THEN THE System SHALL deny the request, display an authorization error indicating the Buyer lacks permission, return none of the other Chain's data, avoid confirming whether the requested data exists, and keep the Buyer signed in with the current view unchanged.
5. WHERE the System runs in demo mode with Example Data, THE System SHALL let the user switch between Chains A to E and the Pool Operator role without a password, and SHALL display only the data permitted for the selected role within 2 seconds of the switch.
6. IF a user submits invalid sign-in credentials, THEN THE System SHALL reject the sign-in, display an error that does not reveal which credential was wrong, and not start a session; after 5 consecutive failed attempts for the same account within 15 minutes, THE System SHALL reject further sign-in attempts for that account for 15 minutes and display an error stating that sign-in is temporarily locked.
7. WHEN a signed-in user has had no activity for 30 minutes, THE System SHALL end the session, hide all Chain data and present the sign-in screen.
