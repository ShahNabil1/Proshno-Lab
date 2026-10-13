-- Ready package prices, preserving IDs and historical orders.
BEGIN;
CREATE TEMP TABLE ready_catalog_seed (type text,class_name text,subject_name text,price integer,sort_order integer) ON COMMIT DROP;
INSERT INTO ready_catalog_seed VALUES
('class','তৃতীয় শ্রেণি','সকল বিষয়',499,500),
('class','চতুর্থ শ্রেণি','সকল বিষয়',599,501),
('class','পঞ্চম শ্রেণি','সকল বিষয়',699,502),
('class','ষষ্ঠ শ্রেণি','সকল বিষয়',999,503),
('class','সপ্তম শ্রেণি','সকল বিষয়',999,504),
('class','অষ্টম শ্রেণি','সকল বিষয়',999,505),
('class','নবম-দশম শ্রেণি','সকল বিষয়',1499,506),
('class','একাদশ-দ্বাদশ শ্রেণি','সকল বিষয়',1299,507),
('bundle','তৃতীয় - পঞ্চম','সকল বিষয়',1499,508),
('bundle','ষষ্ঠ - অষ্টম','সকল বিষয়',2499,509),
('bundle','তৃতীয় - অষ্টম','সকল বিষয়',2999,510),
('bundle','ষষ্ঠ - দশম','সকল বিষয়',3499,511),
('bundle','তৃতীয় - দশম','সকল বিষয়',3999,512),
('bundle','পঞ্চম - অষ্টম','সকল বিষয়',2699,513),
('bundle','পঞ্চম - দশম','সকল বিষয়',3699,514),
('bundle','ষষ্ঠ - দ্বাদশ','সকল বিষয়',4499,515),
('bundle','তৃতীয় - দ্বাদশ','সকল বিষয়',4999,516),
('bundle','ষষ্ঠ - দশম','বাংলা',699,517),
('bundle','ষষ্ঠ - দশম','গণিত',699,518),
('bundle','ষষ্ঠ - দশম','বিজ্ঞান',699,519),
('bundle','ষষ্ঠ - দশম','English',699,520),
('bundle','ষষ্ঠ - দশম','তথ্য ও যোগাযোগ প্রযুক্তি',699,521),
('bundle','ষষ্ঠ - দশম','বাংলাদেশ ও বিশ্বপরিচয়',699,522),
('bundle','ষষ্ঠ - দশম','ইসলাম শিক্ষা',699,523),
('bundle','ষষ্ঠ - দশম','কৃষি শিক্ষা',699,524);
UPDATE public.pricing_packages p SET price=s.price,duration_days=365,is_active=true,sort_order=s.sort_order FROM ready_catalog_seed s WHERE p.type=s.type AND p.class_name=s.class_name AND p.subject_name=s.subject_name;
INSERT INTO public.pricing_packages (type,class_name,subject_name,price,sort_order,duration_days,is_active) SELECT s.type,s.class_name,s.subject_name,s.price,s.sort_order,365,true FROM ready_catalog_seed s WHERE NOT EXISTS (SELECT 1 FROM public.pricing_packages p WHERE p.type=s.type AND p.class_name=s.class_name AND p.subject_name=s.subject_name);
COMMIT;
