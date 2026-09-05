# Agent Commerce

Build a full-stack SaaS application called AGENTX – Autonomous Commerce Intelligence.

The application is an AI-powered commerce intelligence dashboard that analyzes business sales, products, inventory and customers, detects revenue opportunities and leaks, generates smart offers, forecasts demand, and recommends autonomous business actions.

Use a clean modern enterprise SaaS dashboard UI with responsive design.

CORE PAGES:

Login

Register

Dashboard

Products

Customers

Sales

Autonomous Actions

Action History

DATABASE:

Create PostgreSQL tables:

businesses(
business_id,
business_name,
owner_name,
email,
created_at
)

users(
user_id,
business_id,
name,
email,
password_hash,
role,
created_at
)

products(
product_id,
business_id,
product_name,
category,
price,
cost,
stock,
created_at,
updated_at
)

customers(
customer_id,
business_id,
name,
email,
phone,
total_spent,
created_at
)

sales(
sale_id,
business_id,
product_id,
customer_id,
quantity,
unit_price,
total_amount,
sale_date
)

autonomous_actions(
action_id,
business_id,
action_type,
product_id,
customer_id,
priority,
reason,
estimated_opportunity,
discount_percent,
price_change_percent,
margin_percent,
status,
created_at,
approved_at,
executed_at,
rejected_at
)

action_history(
history_id,
action_id,
business_id,
previous_status,
new_status,
performed_by,
reason,
created_at
)

DASHBOARD:

Display:

Total Revenue

Total Orders

Total Products

Total Customers

Opportunity Radar:

Sales Growth score 0–100

Customer Opportunity score 0–100

Product Opportunity score 0–100

Revenue Risk score 0–100

Revenue Leak Detection:

Detect low sales, excess inventory, inactive customers and other revenue risks.

Display:

Product/customer

Risk level

Potential revenue loss

Recommendation

Customer Intent:

Calculate a 0–100 purchase intent score using order frequency, total spending and activity.

Classify:

High

Medium

Low

Smart Offer:

Display:

Customer

Product

Original price

Recommended discount

Final offer price

Reason

Demand Forecast:

Display:

Product

Current stock

Historical sales

Forecast demand

Recommended stock

Demand level

AUTONOMOUS ACTION AGENT:

Generate actions such as:

PRODUCT_PROMOTION:

product_id

product_name

priority

discount_percent

reason

estimated_opportunity

recommended_action

status

CUSTOMER_RETENTION:

customer_id

customer_name

priority

discount_percent

reason

estimated_opportunity

recommended_action

status

Default AI discount must be 10%.

ACTION STATE MACHINE:

Pending Approval → Approved → Executed

Pending Approval → Rejected

Guardrail failure → Blocked

Blocked actions must never be executable.

GUARDRAILS:

MAX_DISCOUNT_PERCENT = 15

MAX_PRICE_CHANGE_PERCENT = 20

MIN_MARGIN_PERCENT = 10

Every approve and execute request must run through guardrail validation.

If discount_percent > 15:
Block the action and return:
"Discount cannot exceed 15%."

If absolute price_change_percent > 20:
Block the action and return:
"Price change cannot exceed 20%."

If margin_percent < 10:
Block the action and return:
"Margin cannot go below 10%."

ACTION API:

GET /api/actions/:business_id

POST /api/actions/:id/approve

POST /api/actions/:id/reject

POST /api/actions/:id/execute

GET /api/actions/history/:business_id

AI API:

GET /api/ai/opportunities/:business_id

GET /api/ai/revenue-leaks/:business_id

GET /api/ai/customer-intent/:business_id

GET /api/ai/smart-offer/:business_id

GET /api/ai/demand-forecast/:business_id

GET /api/ai/autonomous-actions/:business_id

POST /api/ai/simulate

IMPORTANT DATABASE RULE:

GET endpoints must NEVER insert new records.

AI-generated autonomous actions must be persisted through a dedicated create/upsert operation.

Prevent duplicate autonomous actions using appropriate uniqueness checks.

APPROVAL:

When user clicks APPROVE:

Send action ID and action parameters to backend.

Validate guardrails.

If valid, change status to Approved.

Create action_history record.

Return success response.

REJECTION:

When user clicks REJECT:

Change status to Rejected.

Store rejected_at.

Create action_history record.

EXECUTION:

Only Approved actions can be executed.

Before execution, validate guardrails again.

Change status to Executed.
Set executed_at.
Create action_history record.

BLOCKED ACTIONS:

Display a clear guardrail alert showing the exact reason.

WHAT-IF SIMULATOR:

Allow user to enter price change percentage.

Calculate:

Current revenue

Estimated revenue

Revenue impact

Estimated orders

Apply the price-change guardrail.

UI REQUIREMENTS:

Use responsive enterprise SaaS design.

Use cards, tables, badges, charts and clear status indicators.

Action statuses should have visually distinct badges:

Pending Approval
Approved
Executed
Rejected
Blocked

The Autonomous Action Agent should be the most prominent AI section on the dashboard.

Add loading states, empty states, error handling and success/error notifications.

Never expose database credentials in frontend code.

Keep business_id/user_id scoped so one business cannot access another business's data.

Seed the application with realistic demo data so the dashboard works immediately after setup.

The entire application must be functional end-to-end rather than static mock UI.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9660472f-090a-406d-9fc6-f71203f14576).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
