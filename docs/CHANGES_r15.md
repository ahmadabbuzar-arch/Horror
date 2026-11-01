# r15 — graveyard was empty: the Cluny scan floated 16 m in the air (NOT tested on a phone)
Cause: the scan is stored tilted (root node = a non-axis-aligned rotation). The game measures a model from each mesh's LOCAL box rotated by the node matrix; for a tilted scan that box is
far too big (it saw y -21.7..15.1 instead of -5.6..7.5), so it lifted the scan by 21.7 m instead of 5.6 m = 16 m above the ground. The wall / gate / hand have only 90-degree rotations, so they were fine.
Fix: tools/prep_scan_color.py now bakes the node transform into the vertices (identity nodes). Checked every GLB in assets/props: bbox inflation 0.00 m for all six.
Rule for new scans: run a bbox-inflation check (see the snippet in this change's chat / sim) or bake the rotation first.
