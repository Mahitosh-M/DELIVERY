# App icon and responsive splash

The icon's original white margin was part of its PNG. The previous splash used `object-fit: contain` inside a 460px frame, leaving blank bars on taller or wider screens.

The corrected icon is opaque and full bleed. Separate Android maskable artwork keeps the van and pin inside the safe region for circular and rounded launcher masks. Apple uses a 180px touch icon. All four packaged icons have opaque, non-white perimeter pixels.

The first HTML paint and the authenticated loading screen now use the same fixed, full-viewport cover layout. Phones and portrait tablets use the supplied portrait image unchanged. Screens at least 4:3 use a landscape adaptation, keeping the logo and van visible. Modest cropping fills each viewport; artwork is never stretched. Pale sky within the supplied illustration remains part of the image, rather than a blank surrounding panel. Normal application pages retain their compact phone-width layout.

## Assets and packaging

- `public/app-icon.png`: corrected full-bleed source.
- `assets/branding/icon-maskable-source.png`: Android source with additional safe space.
- `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `public/icon-maskable-512.png`: packaged launch icons.
- `public/splash-screen.png`: original portrait illustration.
- `public/splash-landscape.png`: responsive landscape illustration.

Run `npm run assets:icons` to resize the approved icon sources using the existing Playwright browser. It uses cached Chromium when available, otherwise Playwright's installed Chromium. This command only packages sizes; it does not regenerate artwork. `npm run build` includes both splash orientations and icons in the offline precache.

Installed launchers can cache app icons independently of website files. Close/reopen and accept the app update first. If the operating system still shows the old icon, remove only its installed shortcut/app and add it again; do not clear browser storage, which may hold unsent work. Browsers and operating systems control their own initial launch surfaces before web content appears; the full-screen illustration applies when Dispatch's page renders.

## Verification

The production build passes. Chromium regressions verify the initial HTML splash, reconnecting authenticated splash and opaque icon borders. Screenshots were reviewed at 320×568, 390×844, 430×932, 768×1024, 1024×768, 844×390 and 1280×900. This is responsive browser verification, not physical-device testing of every operating system launcher.

## Image editing provenance

The built-in imagegen tool edited the supplied artwork. Original Downloads files were left intact. The following prompts produced the three source assets; resizing uses the packaging script above.

### Full-bleed icon prompt

Edit the supplied app icon. This is a precise background/framing correction, not a redesign. Remove the outer white margin and all white corner regions outside the rounded colorful tile. Extend the existing cyan/blue/purple/magenta background seamlessly to every edge and every corner of a full-bleed opaque square app icon. No rounded outer tile boundary, no border, no padding, no white outer background. Preserve the existing medical delivery truck, blue medical cross, location pin, speed streaks, bright colors, 3D illustration, composition and proportions as closely as possible. Keep the truck and location pin fully visible, approximately the same relative size; do not add any new objects or text. The result must be an edge-to-edge square app icon, suitable for mobile launcher masking.

### Landscape splash prompt

Create a landscape adaptation of the supplied splash screen for the same application, preserving its exact medical-delivery illustration style, bright cyan/blue/magenta palette, white medical van with blue cross, location-pin symbol, illustrated town, trees and curved road. Wide landscape aspect ratio 16:9. This is a responsive art-direction/framing correction, not a new brand. Exact existing text: 'MediGo' and 'MEDICINE DELIVERED TO YOU'. Keep text fully legible and faithfully styled with Medi in dark navy and Go in blue/magenta. Arrange the original logo with small van and location pin above the text on the left half, and the larger medical delivery truck and illustrated road/town on the right/lower half, allowing the landscape composition to occupy the entire canvas. Extend the existing town/sky/road artwork edge to edge, without exterior white margins, no enclosing rounded card, no border, no padding. Pale sky can remain part of the illustration but avoid large empty white top/bottom regions. Keep all important logo/text/truck artwork comfortably inset from the outer edges so modest responsive cover-cropping remains safe. Do not add any new wording, new brands or objects.

### Android maskable icon prompt

Precisely adapt this supplied medical delivery app icon for Android adaptive/maskable launcher icons. Remove ALL white outer padding and rounded tile corners; fill the entire opaque square canvas edge-to-edge with the existing vivid blue/cyan/purple/magenta background, smoothly extended without any visible square inset boundary. Preserve the illustrated white medical van with blue cross, location pin and speed streaks, same shapes and style. Scale the entire foreground group down slightly and center it so ALL parts of the truck, location pin and speed streaks fit inside the central circle whose diameter is 78 percent of the square canvas width. Leave generous colorful background on every side for circular, squircle or rounded-square platform masks. Do not place a circle around the artwork. No outer white areas, no borders, no transparent areas, no text, no new objects. Output a square.
