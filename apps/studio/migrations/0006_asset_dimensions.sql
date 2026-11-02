-- Intrinsic image size, so editors can reserve each image's space before it loads.
-- Additive: existing rows stay NULL until the asset list fills them in; older Workers ignore it.
ALTER TABLE assets ADD COLUMN width INTEGER;
ALTER TABLE assets ADD COLUMN height INTEGER;
