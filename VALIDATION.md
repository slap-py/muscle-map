# Validation — Foot & Ankle

Checked October 4, 2026.

- TypeScript/Vite production build passes.
- Eight automated tests cover bone counts and toe segmentation, valid reciprocal attachment relationships, finite selectable geometry for every active atlas entry, smooth camera convergence and bounds, and anatomical compass projection.
- The active atlas excludes the femur and knee; the regional model replaces the earlier full-leg assembly.
- Browser inspection: overview, medial skeleton and plantar views; individual retinaculum selection; connection lists; fascia/cartilage layer controls; camera compass direction switching.
- Compass marker positions change during orbit; the medial and lateral axes remain opposites in camera coordinates.
- Smooth camera controller and pan interactions retained from the previous update.
- Hover checks sampled 40 visible structures across all six tissue types: atlas names highlight and temporary model labels appear with Labels off. Pointer leave clears the preview, click selection persists, and dragging suppresses hover without selecting a structure. No browser errors occurred.
- Label transition checks verify persistent label elements, fade-out and cleanup, cancellation of fleeting hover previews, preserved click selection, and immediate transitions with reduced motion enabled. No browser errors occurred.

These checks validate rendering and interaction. Anatomical shape fidelity remains approximate and has not been clinically validated. See README.md for scope and omissions.
