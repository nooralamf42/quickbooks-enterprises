# MSG91 templates (generated from app/lib/emailTemplates.ts)

Each `*.body.html` is the exact HTML Postal sends today, with the changing parts turned into
Handlebars variables. Each `*.subject.txt` is the subject line to paste into MSG91's Subject field.
Filled in with real values, every template reproduces today's email (checked by rendering each one
with the Handlebars library and comparing to the live renderer; only blank-line whitespace differs).

How to add one in MSG91: Email > Templates > Create Template > Start from scratch > HTML & Text Editor.
Name = the template name below. Subject = contents of the `.subject.txt`. Paste the `.body.html` into the
code box, then Submit For Approval. The template ID is the name (slug) MSG91 shows.

Variable names must match exactly. Values are plain text (Handlebars escapes `& < > " '`), dates are MM/DD/YYYY,
amounts have no `$` sign (the template adds it) and use two decimals, e.g. `7674.30`.
Optional variables: leave them out (or empty) and their value disappears; the row's label goes with it.
(The conditions sit inside table cells on purpose: HTML parsers, including MSG91's visual editor, move bare
`{{#if}}` text out of a table. A missing optional row leaves a small empty gap, about 6px, instead of vanishing.)

| Template name (suggested) | Files | Subject |
|---|---|---|
| qbe_receipt | receipt.* | We received your QuickBooks Enterprise payment! |
| qbe_reminder | reminder.* | Action needed: update your QuickBooks Enterprise payment method |
| qbe_reminder_payroll | reminder-payroll.* | Take action to stop your payroll subscription from being cancelled |
| qbe_refund | refund.* | Your QuickBooks Enterprise refund has been processed |
| qbe_survey | survey.* | We would like your feedback |
| qbe_query | query.* | {{subject}} |

## Variables

### qbe_receipt
Required: `customer_name`, `to_email`, `company_name`, `order_id`, `invoice_date`, `amount`, `payment_method`
Optional: `plan`, `due_date`, `num_users`, `contract_term` (e.g. "1 Year", "2 Years"), `license_number`, `product_number`

### qbe_reminder and qbe_reminder_payroll (same body)
Required: `customer_name`, `to_email`, `company_name`, `amount_due`, `payment_method`, `due_date`, `cancellation_date`, `cta_url`
Optional: `plan_label` (value of the "Plan:" row; billing cycle or plan name), `plan` ("Affected subscriptions"), `num_users`, `contract_term`

### qbe_refund
Required: `customer_name`, `to_email`, `company_name`, `refund_number`, `refund_date`, `refund_amount`, `payment_method`
Optional: `plan`, `reason`

### qbe_survey
Required: `to_email`, `survey_u`, `survey_n`, `survey_co` (base64 of the recipient email, name and company: the same values the survey links carry today)
Optional: `customer_name` (greeting), `company_name`

### qbe_query
Required: `subject`, `to_email`, `paragraphs` (array of strings: the message split on blank lines)
Optional: `customer_name`

## Not covered by a template
`from`, `reply_to` and attachments go in the API request itself, not the template.
`{{{x}}}` (three braces, unescaped) is used only for the survey link parts; the rest use `{{x}}`.
