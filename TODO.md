[X] Basic landing page that outlines the features and reminds that none of your data is saved to the server

[ ] No option to withdraw from savings
[ ] Would withdrawing from a saver by entering a negative amount in a transaction work? Check what happens if user enters negative amounts for other things

[ ] Shared sessions by using encrypted blobs on Cloudflare workers and R2
  - Only need 2 endpoints
  - Store only userId → blob, lastUpdatedAt
  - Client downloads, decrypts, loads on startup, and encrypts and uploads on save

[X] Import transactions from exported Up Bank CSV

[ ] Editing an exisiting recurring forecast still goes to an old style details edit view.

[X] Can we move or have another error boundary within the sidebar?
