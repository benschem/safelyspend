[ ] Add button to dashboard to load demo data, that adds a permanent flash telling you it's demo data and gives you a clear data button to delete all demo data and start entering your own data

[ ] Dashboard should also show how you're tracking against the budget for each category

[ ] Add a savings option along with income and expense in transaction and forecasts. Right now, adding to a savings goal can only be done by editing the goal - this should not be possible. Users cannot edit the momey amount of a savings goal, only add transactions and forecasts with type savings

[ ] Then dashboard should show forecast savings alongside actual savings for a goal. Savings are not "Available to spend"

[ ] Would withdrawing from a saver by entering a negative amount in a transaction work? Check what happens if user enters negative amounts for other things

[ ] Basic landing page that outlines the features and reminds that none of your data is saved to the server

[ ] Shared sessions by using encrypted blobs on Cloudflare workers and R2
  - Only need 2 endpoints
  - Store only userId → blob, lastUpdatedAt
  - Client downloads, decrypts, loads on startup, and encrypts and uploads on save

[ ] Graphs

[ ] Balances show small arrow up or arrow down +/-30% in green/red next to the numbers
