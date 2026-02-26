
CREATE TABLE public.pricing_packages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'class' CHECK (type IN ('bundle', 'class')),
  class_name TEXT NOT NULL,
  subject_name TEXT NOT NULL DEFAULT 'সকল বিষয়',
  price INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active packages"
ON public.pricing_packages FOR SELECT USING (true);

CREATE POLICY "Admins can manage packages"
ON public.pricing_packages FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial data from the hardcoded values
INSERT INTO public.pricing_packages (type, class_name, subject_name, price, sort_order) VALUES
  ('bundle', 'ষষ্ঠ - দশম', 'সকল বিষয়', 900, 1),
  ('bundle', 'ষষ্ঠ - দ্বাদশ', 'সকল বিষয়', 1200, 2),
  ('class', 'ষষ্ঠ শ্রেণি', 'সকল বিষয়', 399, 10),
  ('class', 'ষষ্ঠ শ্রেণি', 'গণিত', 199, 11),
  ('class', 'ষষ্ঠ শ্রেণি', 'বিজ্ঞান', 199, 12),
  ('class', 'ষষ্ঠ শ্রেণি', 'তথ্য ও যোগাযোগ প্রযুক্তি', 199, 13),
  ('class', 'সপ্তম শ্রেণি', 'সকল বিষয়', 399, 20),
  ('class', 'সপ্তম শ্রেণি', 'গণিত', 199, 21),
  ('class', 'সপ্তম শ্রেণি', 'বিজ্ঞান', 199, 22),
  ('class', 'সপ্তম শ্রেণি', 'তথ্য ও যোগাযোগ প্রযুক্তি', 199, 23),
  ('class', 'অষ্টম শ্রেণি', 'সকল বিষয়', 399, 30),
  ('class', 'অষ্টম শ্রেণি', 'গণিত', 199, 31),
  ('class', 'অষ্টম শ্রেণি', 'বিজ্ঞান', 199, 32),
  ('class', 'অষ্টম শ্রেণি', 'তথ্য ও যোগাযোগ প্রযুক্তি', 199, 33),
  ('class', 'নবম-দশম শ্রেণি', 'সকল বিষয়', 399, 40),
  ('class', 'নবম-দশম শ্রেণি', 'গণিত', 199, 41),
  ('class', 'নবম-দশম শ্রেণি', 'বিজ্ঞান', 199, 42),
  ('class', 'নবম-দশম শ্রেণি', 'তথ্য ও যোগাযোগ প্রযুক্তি', 199, 43),
  ('class', 'একাদশ শ্রেণি', 'সকল বিষয়', 399, 50),
  ('class', 'একাদশ শ্রেণি', 'গণিত', 199, 51),
  ('class', 'একাদশ শ্রেণি', 'বিজ্ঞান', 199, 52),
  ('class', 'একাদশ শ্রেণি', 'তথ্য ও যোগাযোগ প্রযুক্তি', 199, 53),
  ('class', 'দ্বাদশ শ্রেণি', 'সকল বিষয়', 399, 60),
  ('class', 'দ্বাদশ শ্রেণি', 'গণিত', 199, 61),
  ('class', 'দ্বাদশ শ্রেণি', 'বিজ্ঞান', 199, 62),
  ('class', 'দ্বাদশ শ্রেণি', 'তথ্য ও যোগাযোগ প্রযুক্তি', 199, 63);
