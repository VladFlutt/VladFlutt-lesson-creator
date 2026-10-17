-- Grammar instrument: a built-in block plus an admin-managed list of grammar
-- topics per lesson language that tutors pick from (up to three per lesson).

create table grammar_topics (
  id uuid primary key default gen_random_uuid(),
  language_code text not null,          -- lesson language the topic belongs to
  level text,                           -- suggested level (A1..C2), null = any
  name jsonb not null,                  -- {"el": "...", "ru": "...", "en": "..."}
  status item_status not null default 'active',
  sort int not null default 100,
  created_at timestamptz not null default now()
);
create index grammar_topics_language on grammar_topics (language_code, sort);

alter table grammar_topics enable row level security;
create policy "read active grammar topics" on grammar_topics for select using (status = 'active');

-- Grammar sits right after the word cards.
update instruments set sort = sort + 1 where sort >= 4;
insert into instruments (key, name, description, is_builtin, default_on, sort) values
  ('grammar', '{"el":"Γραμματική","ru":"Грамматика","en":"Grammar"}',
   'Explanation of up to three chosen grammar topics with forms and examples; the exercises practise them.', true, true, 4)
on conflict (key) do nothing;

insert into grammar_topics (language_code, level, name, sort) values
  ('el', 'A1', '{"el":"Άρθρα και γένος ουσιαστικών","ru":"Артикли и род существительных","en":"Articles and noun gender"}', 10),
  ('el', 'A1', '{"el":"Είμαι και έχω","ru":"Глаголы «быть» и «иметь»","en":"To be and to have"}', 20),
  ('el', 'A1', '{"el":"Ενεστώτας ρημάτων (-ω, -άω/-ώ)","ru":"Настоящее время глаголов (-ω, -άω/-ώ)","en":"Present tense (-ω, -άω/-ώ verbs)"}', 30),
  ('el', 'A1', '{"el":"Πληθυντικός ουσιαστικών","ru":"Множественное число существительных","en":"Plural of nouns"}', 40),
  ('el', 'A1', '{"el":"Προσωπικές αντωνυμίες","ru":"Личные местоимения","en":"Personal pronouns"}', 50),
  ('el', 'A1', '{"el":"Ερωτηματικές λέξεις","ru":"Вопросительные слова","en":"Question words"}', 60),
  ('el', 'A2', '{"el":"Αιτιατική πτώση","ru":"Винительный падеж","en":"Accusative case"}', 110),
  ('el', 'A2', '{"el":"Αόριστος","ru":"Аорист (прошедшее время)","en":"Simple past (aorist)"}', 120),
  ('el', 'A2', '{"el":"Μέλλοντας (θα)","ru":"Будущее время (θα)","en":"Future tense (θα)"}', 130),
  ('el', 'A2', '{"el":"Κτητικές αντωνυμίες","ru":"Притяжательные местоимения","en":"Possessive pronouns"}', 140),
  ('el', 'A2', '{"el":"Επίθετα και συμφωνία","ru":"Прилагательные и согласование","en":"Adjectives and agreement"}', 150),
  ('el', 'A2', '{"el":"Προστακτική","ru":"Повелительное наклонение","en":"Imperative"}', 160),
  ('el', 'A2', '{"el":"Σύγκριση επιθέτων","ru":"Степени сравнения прилагательных","en":"Comparison of adjectives"}', 170),
  ('el', 'B1', '{"el":"Παρατατικός","ru":"Имперфект (паратактикос)","en":"Imperfect (past continuous)"}', 210),
  ('el', 'B1', '{"el":"Υποτακτική (να)","ru":"Сослагательное наклонение (να)","en":"Subjunctive (να)"}', 220),
  ('el', 'B1', '{"el":"Γενική πτώση","ru":"Родительный падеж","en":"Genitive case"}', 230),
  ('el', 'B1', '{"el":"Αδύνατοι τύποι προσωπικών αντωνυμιών","ru":"Краткие формы личных местоимений","en":"Weak (clitic) pronouns"}', 240),
  ('el', 'B1', '{"el":"Παθητική φωνή (ενεστώτας)","ru":"Страдательный залог (настоящее время)","en":"Passive voice (present)"}', 250),
  ('el', 'B1', '{"el":"Αναφορικές προτάσεις (που, ο οποίος)","ru":"Относительные придаточные (που, ο οποίος)","en":"Relative clauses (που, ο οποίος)"}', 260),
  ('el', 'B2', '{"el":"Παρακείμενος και υπερσυντέλικος","ru":"Перфект и плюсквамперфект","en":"Present perfect and past perfect"}', 310),
  ('el', 'B2', '{"el":"Παθητική φωνή (αόριστος)","ru":"Страдательный залог (аорист)","en":"Passive voice (aorist)"}', 320),
  ('el', 'B2', '{"el":"Μετοχές","ru":"Причастия","en":"Participles"}', 330),
  ('el', 'B2', '{"el":"Υποθετικοί λόγοι","ru":"Условные предложения","en":"Conditional sentences"}', 340),
  ('el', 'C1', '{"el":"Πλάγιος λόγος","ru":"Косвенная речь","en":"Reported speech"}', 410),
  ('el', 'C1', '{"el":"Λόγιοι τύποι και εκφράσεις","ru":"Книжные формы и выражения","en":"Formal and learned forms"}', 420),

  ('ru', 'A1', '{"el":"Γένος ουσιαστικών","ru":"Род существительных","en":"Noun gender"}', 10),
  ('ru', 'A1', '{"el":"Ενεστώτας: 1η και 2η συζυγία","ru":"Настоящее время: 1 и 2 спряжение","en":"Present tense: 1st and 2nd conjugation"}', 20),
  ('ru', 'A1', '{"el":"Προσωπικές και κτητικές αντωνυμίες","ru":"Личные и притяжательные местоимения","en":"Personal and possessive pronouns"}', 30),
  ('ru', 'A1', '{"el":"Πληθυντικός ουσιαστικών","ru":"Множественное число существительных","en":"Plural of nouns"}', 40),
  ('ru', 'A1', '{"el":"Προθετική πτώση (πού;)","ru":"Предложный падеж (где?)","en":"Prepositional case (where?)"}', 50),
  ('ru', 'A2', '{"el":"Αιτιατική πτώση","ru":"Винительный падеж","en":"Accusative case"}', 110),
  ('ru', 'A2', '{"el":"Γενική πτώση","ru":"Родительный падеж","en":"Genitive case"}', 120),
  ('ru', 'A2', '{"el":"Παρελθοντικός χρόνος","ru":"Прошедшее время","en":"Past tense"}', 130),
  ('ru', 'A2', '{"el":"Μέλλοντας","ru":"Будущее время","en":"Future tense"}', 140),
  ('ru', 'A2', '{"el":"Ρήματα κίνησης (идти / ходить)","ru":"Глаголы движения (идти / ходить)","en":"Verbs of motion (идти / ходить)"}', 150),
  ('ru', 'B1', '{"el":"Ποιόν ενεργείας του ρήματος","ru":"Вид глагола","en":"Verb aspect"}', 210),
  ('ru', 'B1', '{"el":"Δοτική πτώση","ru":"Дательный падеж","en":"Dative case"}', 220),
  ('ru', 'B1', '{"el":"Οργανική πτώση","ru":"Творительный падеж","en":"Instrumental case"}', 230),
  ('ru', 'B1', '{"el":"Ρήματα κίνησης με προθέματα","ru":"Глаголы движения с приставками","en":"Prefixed verbs of motion"}', 240),
  ('ru', 'B1', '{"el":"Προστακτική","ru":"Повелительное наклонение","en":"Imperative"}', 250),
  ('ru', 'B1', '{"el":"Συγκριτικός βαθμός επιθέτων","ru":"Сравнительная степень прилагательных","en":"Comparative adjectives"}', 260),
  ('ru', 'B2', '{"el":"Μετοχές","ru":"Причастия","en":"Participles"}', 310),
  ('ru', 'B2', '{"el":"Γερούνδια (деепричастия)","ru":"Деепричастия","en":"Verbal adverbs"}', 320),
  ('ru', 'B2', '{"el":"Υποθετική έγκλιση (бы)","ru":"Условное наклонение (бы)","en":"Conditional mood (бы)"}', 330),
  ('ru', 'B2', '{"el":"Αναφορικές προτάσεις (который)","ru":"Придаточные с «который»","en":"Relative clauses (который)"}', 340),
  ('ru', 'C1', '{"el":"Απρόσωπες κατασκευές","ru":"Безличные конструкции","en":"Impersonal constructions"}', 410),
  ('ru', 'C1', '{"el":"Μετοχικές και γερουνδιακές φράσεις","ru":"Причастные и деепричастные обороты","en":"Participial and adverbial phrases"}', 420);
