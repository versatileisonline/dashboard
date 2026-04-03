# Canvas+ 

#### Description
Students often face the issue of a fragmented workflow. While Canvas is the primary Learning Management System (LMS) for Virginia Tech and most other universities, it rarely capture sthe full scope of student's academic responsibilites. 

We purpose Canvas+, a Chromimum-based browser extension that injects a "Course Homepage" interface directly into the existing Canvas Dashboard. Canvas+ will integrate seamlessly into the students' existing workflow without the need to visit another site.

#### Installation
1. Open Chrome then chrome extensions
2. Enable `Developer mode` (top-right).
3. Click `Load unpacked`.
4. Select Dashboard folder within your own directory
5. Open your Canvas dashboard (`https://<school>.instructure.com/` or `https://canvas.vt.edu/`) and refresh.

If the sidebar does not appear:
1. Open DevTools on Canvas (`Cmd+Option+I`) and check Console for `[Versatile]` logs.
2. Confirm the extension is enabled in `chrome://extensions`.
3. Click `Reload` on the extension card, then refresh Canvas again.

#### Testing
1. Ensure `node.js` is installed.
2. Run `npm install` to install the Jest unit test package.
3. Run `npm install --save-dev jest-environment-jsdom` to install jsdom environment.
4. Run `npm test`.
Alternatively, run `npm test -- --coverage` for statement and branch coverage.

###### Creators
Bryan Torres (bryantorres), Caiden Romero (caidenromero), Garrett Wright (garrettw02), Aneesh Tummeti (artummeti)
Forked and maintained by Tyler Arb (wtylerarb), Dawson Smedt (dtsmedt), Will Tolley (wmtolley), and Deepika Reddy (deepikar)
