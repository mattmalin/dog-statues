ALTER TABLE dog_statues.potential_statues
ADD images NVARCHAR(MAX) NOT NULL CONSTRAINT DF_potential_images DEFAULT N'[]';
