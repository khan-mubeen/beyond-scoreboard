# Demo script

Target: 2 minutes, no live typing.

## Before

- `npm run build && npm start` on the demo laptop, same wifi as the judges' phones
- Open `/room/TEST/screen` on the projector and `/room/TEST/host` on the laptop
- `npm run fake-players -- TEST 30` so the room is not empty

## Run

1. **Lobby.** Point at the QR code and ask the judges to join with a nickname.
2. **Start the replay** from the host page and jump to the first call: "Who scores next this period?"
3. **Goal.** The table re-sorts and Kärpät cross the playoff line. Phones show "You called it".
4. **Skip ahead** to the third period: the overtime call, then the winner.
5. **Final.** Leaderboard, then open the post-game story with its fact chips and the blocked claim.

## If something breaks

- No wifi: run on localhost and show `/dev/live` stepping through the same game.
- Server crash: restart it. Rooms reset, and TEST always exists.
