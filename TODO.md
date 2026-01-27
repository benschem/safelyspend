[ ] Add button to dashboard to load demo data, that adds a permanent flash telling you it's demo data and gives you a clear data button to delete all demo data and start entering your own data

[X] Dashboard should also show how you're tracking against the budget for each category

[X] Add a savings select option along with income and expense in transaction and forecasts and all the plumbing along with it. Right now, adding to a savings goal can only be done by editing the goal - this should not be possible. Users should not be able to edit the momey amount of a savings goal, but they should be able to add transactions and forecasts with type savings that counts toward the total savings both on the index and dashboard, the savings are also included as a separate line item on the transactions and forecasts cards and counts toward a net plus.

[X] Then dashboard should show forecast savings alongside actual savings for a goal. Savings are not "Available to spend"

[ ] No option to withdraw from savings
[ ] Would withdrawing from a saver by entering a negative amount in a transaction work? Check what happens if user enters negative amounts for other things

[ ] Basic landing page that outlines the features and reminds that none of your data is saved to the server

[ ] Shared sessions by using encrypted blobs on Cloudflare workers and R2
  - Only need 2 endpoints
  - Store only userId → blob, lastUpdatedAt
  - Client downloads, decrypts, loads on startup, and encrypts and uploads on save

[ ] Graphs

[X] Balances show small arrow up or arrow down +/-30% in green/red next to the numbers
[ ] Are these +30% figures broken?

[X] RFC: Remove bank accounts in favour of a single balance representing your total cash-in-hand spending money both avaliable and allocated (as opposed to savings). It shouldn't matter which banks or accounts you spread that money over in the real world, they're just everyday accounts with low to no interest and it's too tedious to choose an account for each transaction and forecast. Current usage of multiple accounts adds no value and is not really represented in the dashboard. Enhancing the current situation would not really bring much benefit to the user, so I say let's take it out and simplify.
