# CIS Dispatch: simple steps

An invoice is a bill. A delivery job is one order to deliver. A route is a road plan. A trip is one van journey on one date.

## Our example

Sunrise Medical orders three boxes. Its bill is A-101 for Rs 2,000. Route 1 goes from Road A to Road B and runs on Monday. This is an example only: do not create test customer records in the real app.

## 1. Admin prepares the app

1. Sign in to CIS Dispatch with email and password. The correct account is chosen automatically.
2. Open Configuration. Check the real shops, van and driver accounts. ASHOKA is Maski; SMPA is Sindhanur.
3. Open Configuration > Routes > Add route.
4. Name it Route 1. Enter Road A as the start and Road B as the destination.
5. Add the stops in visiting order. Select Monday. Tick the shops whose staff should be able to select this route on invoices. Save.

Available to shops controls which invoice staff can choose the route. It does not decide the van's starting shop.

## 2. Staff prepares the order in CISapp

1. Create and save the real invoice for Sunrise Medical. Do not enter a payment if the customer has not paid yet.
2. Choose Mark for delivery, or tick Delivery required during invoice entry and save the invoice first.
3. Choose Route 1 and the correct stop. The form shows its current weekly loading/dispatch days.
4. Check the scheduled date: choose the Monday when these three boxes should go. A route selection suggests a matching date, but staff can choose an exception date.
5. Enter three packages, the complete delivery address, phone number and instructions. Save the delivery request.

Choosing Route 1 puts a label on the order. It does not book a van or release a trip.

## 3. Manager makes that day's van trip

1. Sign in to Dispatch. New data downloads after sign-in and browser reload.
2. If the invoice was added while Dispatch was already open, pull down from the top of the page, or open Connection > Synchronise now.
3. Open Route Planner > Plan route.
4. Choose Weekly route: Route 1. Choose exactly the same date as the invoice's scheduled delivery date.
5. Choose starting shop ASHOKA, an ending shop, the van and an authorised primary driver. An accompanying driver is optional.
6. Click Add matching deliveries in stop order, or tick the deliveries you want. Check that Sunrise Medical and its three boxes are selected. You can reorder the real delivery stops.
7. Click Save route draft. Now click Release, or open the trip and choose Release route > Confirm.

Staff/Shop Managers can release trips starting at their own assigned shop. Admin can release trips from either shop. A trip may end at the other shop.

## 4. Driver does the delivery

1. Sign in using the assigned driver's account. On the delivery day, the trip appears on the home screen. Future trips can also be checked under Trips.
2. Open the trip. Start shift, enter the opening odometer and attach its photo.
3. Choose Confirm packages loaded and confirm after checking the boxes in the van.
4. Open Sunrise Medical's stop. Use Call or Navigation if needed.
5. Deliver all three boxes. Choose Delivered and capture the customer's signature or an acknowledged document photo.
6. If the customer gives Rs 2,000, use Record collection. Choose the customer, Cash and Rs 2,000. Submit it for review. Older unpaid bills can also be selected; the Manager reviews the allocation.
7. If only two boxes are delivered, record Partial and two boxes. If delivery fails, choose the correct reason. Do not mark all three delivered.
8. Record diesel litres and price per litre; the total calculates automatically. Pump name is optional. Attach the receipt. Without a shop advance, choose Personal funds.
9. At the end, enter the closing odometer, attach its photo and submit the shift end. Failed/partial packages remain for Manager reconciliation; no extra checkbox is needed.

Credit/no collection means the customer has not paid now. It does not create a cash receipt.

## 5. Manager checks and closes

1. Refresh Dispatch and open the ended trip. You see three numbered steps.
2. Click Check cash. Review any pending customer collections, then return to cash reconciliation.
3. Count the cash and confirm physical handover. The explanation is optional. You return to the trip and step 1 shows a green tick.
4. Click Check diesel, if diesel was entered. The newest pending bill opens. The review note is optional. Approve or reject and return to the trip. Repeat for other bills.
5. For personal fuel, approve with reimbursement pending, or choose Approve & reimburse only after actually paying the driver. Pending reimbursements need Settle before the diesel step is complete. Shop-funded fuel is deducted in CashApp on approval; personal fuel is deducted on reimbursement. Do not add the same expense twice.
6. Reconcile returned boxes. Click Verify & close shift, check the odometer photos, enter the final review note and confirm.
7. Admin can check reports. CashApp > Fuel shows paid diesel. Completed items leave the pending lists; report/audit summaries remain.

Rs 2,000 received from a customer and the same Rs 2,000 handed to the Manager is still just one customer payment.

## If a delivery is missing from Route Planner

Check these in order:

1. Is the invoice saved in CISapp? An opening-balance record cannot create a delivery.
2. Did you save its Mark for delivery form? An invoice by itself is not a delivery request.
3. Pull down to sync, or choose Synchronise now. New invoices do not appear through a repeating background download.
4. Is the planner date exactly the same as the invoice's scheduled delivery date? Monday 26 October is different from Monday 2 November.
5. Is the chosen weekly route the same? A Route 2 invoice will not appear while filtering Route 1. Choose Custom / all deliveries to check other requests.
6. Open Delivery jobs, clear the search and choose All statuses. Ready means it can be added. Assigned means it is already in another trip (or this saved draft). Delivered, Cancelled, Failed or Partial jobs are not simply ready again.
7. For undelivered packages, the Manager must reconcile returns and reschedule them through Review before adding them to a new trip.
8. Check the shop. Managers see their authorised shop's jobs. Admin can check both shops. A Source review required message means the Manager must fix the source change before release.
9. If the Release button is missing, save the draft first. Release is for a dated trip, not the weekly route setup page. Drivers cannot release trips. Active, End submitted and Closed trips cannot be released as new trips.
10. If the driver cannot see the trip, check it is Released, assigned to that driver and scheduled for the expected date. Sync on the driver's device too.

Example: A-101 is tagged Route 1 for Monday. If the planner shows Tuesday or Route 2, the order will not appear. Select Monday and Route 1, sync, select the order, save the draft and release it.

## Seven-day Dispatch cleanup

The clock starts when the Manager closes the trip, not just when the driver taps Delivered. An hourly server check removes Dispatch delivery detail and its images after seven full days, once cash, claims, reimbursements and undelivered packages are resolved. Pending/unsettled work is retained. Old records with no trustworthy closure timestamp receive a full new seven-day grace period.

Delivery addresses/phone snapshots, instructions, detailed attempts and image files are removed from Dispatch. Small report summaries, odometer continuity and financial/audit history remain. Closed details disappear from Dispatch lists. CISapp invoices, payments, customers and source delivery request data are untouched.

Cached photos on a device are removed when it next successfully synchronises. A device that stays offline cannot receive a remote deletion. Downloaded backups/exports are not erased by this policy.

## Camera and delivery evidence

For odometer readings, signed delivery documents, and diesel receipts, choose **Take photo** to use the phone camera, or **Upload photo** for an existing image. Camera capture depends on support in the device browser; upload remains available. For delivery proof, **Capture signature** also opens the on-screen signing pad. Confirm that the image preview is correct before submitting.

In CISapp Invoices, use the **Delivery required** tile before saving, or **Mark for delivery** on an existing invoice. **Delivery requests** opens delivery review. Route names appear in bold with loading days beneath the selected route.

## Phone and desktop layout

Dispatch uses the same compact app layout on phones, tablets and desktop, with a centred workspace on larger screens. Drivers start on **My trips** and use **Trips**, **Collections**, **Cash**, and **Sales** in the bottom navigation. Managers and Admin use **More** for the remaining authorised modules. Dashboard tiles have centred icons and two columns; narrow phones stack reporting summaries so values stay readable.

## Driver navigation and collection history

Drivers no longer have a Home page, More menu or standalone Fuel page. Opening a saved Home/Fuel link returns to **My trips**. Open a trip to use **Record diesel**, including its camera and upload controls. Connection status and sign-out remain available in the header.

**My collections** keeps pending submissions visible until a decision. Approved and rejected entries remain visible for seven full days after the actual decision, then leave the driver list and details screen. The display updates when the screen is opened, once a minute while open, and when the app regains focus. Reloading does not restart the seven-day clock. Records with an unknown decision date remain visible until that date is available.

This is a driver-screen rule. Ledger entries, physical cash, receipts, allocations, report totals, Manager/Admin review history and audit records are retained. No CISapp records are deleted.
