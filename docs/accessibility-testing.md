# Accessibility testing

## Where this stands

- **Automated scans: done.** `Frontend/e2e/accessibility.spec.ts` runs axe against every storefront page, the main interactive states and the admin, using the WCAG 2.0 and 2.1 A and AA rules. They run in CI.
- **Keyboard and focus behaviour: checked by hand** during development, and covered by component tests (focus trap, Escape, arrow keys, focus on first invalid field).
- **Screen reader: not done.** Nobody has yet listened to the site with NVDA, VoiceOver or TalkBack. Until that happens, the project makes no claim of compliance.

Automated tools find a minority of real problems. They cannot tell whether a label makes sense, whether the reading order is sensible, or whether an announcement is helpful. That is what this checklist is for.

## Set up

Use one of these, with the storefront running (`npm run dev:web`, plus the API for checkout).

| Platform | Screen reader | Browser |
| --- | --- | --- |
| Windows | NVDA (free) | Firefox or Chrome |
| macOS | VoiceOver (Cmd + F5) | Safari |
| iPhone | VoiceOver | Safari |
| Android | TalkBack | Chrome |

Turn the screen off or close your eyes for at least the first pass. Do it once with the keyboard only, with no screen reader, as well.

## Checklist

Mark what fails and where. A pass means you could finish the task without seeing the screen.

### Every page

- [ ] The first Tab stop is "Skip to content", and it moves you into the main content.
- [ ] The page title is read on load and changes when you navigate.
- [ ] Headings make a sensible outline (list them with the reader's heading navigation).
- [ ] The current page is announced in the navigation.
- [ ] Every image is either described sensibly or skipped.
- [ ] Focus is always visible.

### Shop

- [ ] Filter chips announce their name and whether they are pressed.
- [ ] The sort menu announces as a list box, and arrow keys, Home, End and typing work.
- [ ] A product card reads as one clear link: name, price, rating.

### Product page

- [ ] Shade swatches announce their name, whether each is selected, and whether it is sold out.
- [ ] The stock line ("Only 3 left") is read when you change shade.
- [ ] The accordion announces expanded and collapsed.
- [ ] Add to bag announces that the item was added.
- [ ] The rating is read as text, such as "4.5 out of 5 stars".
- [ ] The review form: the star picker works with arrow keys, errors are announced, and focus goes to the first error.

### Bag drawer

- [ ] Opening it announces a dialog called "Your bag", and focus moves inside.
- [ ] Tab stays inside. Content behind it cannot be reached.
- [ ] Changing a quantity announces the new quantity.
- [ ] Escape closes it, and focus returns to the bag button.

### Shade Match

- [ ] Each question and its options are read together.
- [ ] After the last answer, the result is announced and focus is not lost.

### Checkout

- [ ] Every field is read with its label.
- [ ] Submitting with mistakes announces the errors, and focus lands on the first invalid field.
- [ ] Shipping options read as a radio group with their price and delivery time.
- [ ] A refused order (try one with more than the stock) announces the message.
- [ ] The confirmation page is read from the top, with the order number.

### Contact and newsletter

- [ ] Errors are announced. The success message is announced.

### Admin

- [ ] Sign-in errors are announced.
- [ ] Tables read with their headers, row by row.
- [ ] The confirmation before cancelling an order is announced as an alert dialog, and focus goes into it.
- [ ] The stock adjustment form is labelled, and errors are announced.

## Also worth trying

- Zoom to 200 percent, then 400 percent. Nothing should be cut off or overlap.
- Windows High Contrast mode, or forced colors.
- Reduced motion turned on in the operating system. Nothing should animate in a way that matters.
- Touch targets on a real phone.

## Recording results

When you run this, note the date, the screen reader and browser, and what failed. Fix the failures, then add a test for each one that can be automated. Update the Accessibility section of the root README to say what was tested and when, and only then say more than it says today.
