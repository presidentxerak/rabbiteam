/**
 * Banque éditoriale des missions du Lapin (~60).
 * Source de vérité TypeScript ; le seed SQL (supabase/migrations/0002_seed.sql)
 * est généré à partir d'ici et doit rester synchrone.
 *
 * detection 'auto'  : le handler Slack/Notion/Kanban détecte la complétion.
 * detection 'honor' : le Lapin coche lui-même via le bouton de son DM.
 */

export interface MissionDef {
  slug: string;
  tool: "slack" | "notion" | "kanban" | "any";
  difficulty: 1 | 2 | 3;
  briefMd: string;
  detection: "auto" | "honor";
  params: Record<string, unknown>;
}

export const MISSIONS_BANK: MissionDef[] = [
  // ============ SLACK — difficulté 1 ============
  { slug: "carrot_react_3", tool: "slack", difficulty: 1, detection: "auto", params: { emoji: "carrot", count: 3 }, briefMd: "Réagis avec 🥕 dans **3 threads différents** avant vendredi. L'air de rien." },
  { slug: "hands_react_2", tool: "slack", difficulty: 1, detection: "auto", params: { emoji: "raised_hands", count: 2 }, briefMd: "Pose un 🙌 sur **2 messages de collègues différents**. Sois généreux, pas suspect." },
  { slug: "gif_friday_vibes", tool: "slack", difficulty: 1, detection: "honor", params: {}, briefMd: "Poste un GIF (n'importe lequel) dans un canal public. Un seul. Bien choisi." },
  { slug: "emoji_in_status", tool: "slack", difficulty: 1, detection: "honor", params: {}, briefMd: "Mets un emoji **légume** dans ton statut Slack pendant au moins une journée." },
  { slug: "thank_someone", tool: "slack", difficulty: 1, detection: "honor", params: {}, briefMd: "Remercie publiquement un collègue pour quelque chose de précis. La sincérité est ta couverture." },
  { slug: "purple_heart_2", tool: "slack", difficulty: 1, detection: "auto", params: { emoji: "purple_heart", count: 2 }, briefMd: "Dépose un 💜 sur **2 messages** de personnes différentes." },
  { slug: "ask_question_channel", tool: "slack", difficulty: 1, detection: "honor", params: {}, briefMd: "Pose une vraie question dans un canal où tu n'as rien posté cette semaine." },
  { slug: "morning_greeting", tool: "slack", difficulty: 1, detection: "honor", params: {}, briefMd: "Souhaite une bonne journée à l'équipe un matin, avec un emoji soleil. Naturel." },

  // ============ SLACK — difficulté 2 ============
  { slug: "word_constellation", tool: "slack", difficulty: 2, detection: "auto", params: { word: "constellation" }, briefMd: "Place le mot **« constellation »** dans une vraie conversation Slack. Sans que ça paraisse bizarre." },
  { slug: "word_phare", tool: "slack", difficulty: 2, detection: "auto", params: { word: "phare" }, briefMd: "Glisse le mot **« phare »** dans un message de canal public. Contexte crédible exigé." },
  { slug: "word_boussole", tool: "slack", difficulty: 2, detection: "auto", params: { word: "boussole" }, briefMd: "Utilise le mot **« boussole »** dans une discussion d'équipe. En douceur." },
  { slug: "word_marmotte", tool: "slack", difficulty: 2, detection: "auto", params: { word: "marmotte" }, briefMd: "Place **« marmotte »** dans une conversation. Oui, c'est dur. C'est le jeu." },
  { slug: "three_threads_replies", tool: "slack", difficulty: 2, detection: "auto", params: { count: 3, kind: "thread_reply" }, briefMd: "Réponds dans **3 threads différents** que tu n'as pas démarrés, le même jour." },
  { slug: "compliment_chain", tool: "slack", difficulty: 2, detection: "honor", params: {}, briefMd: "Complimente le travail de **2 collègues** dans 2 canaux différents, le même jour." },
  { slug: "share_useful_link", tool: "slack", difficulty: 2, detection: "honor", params: {}, briefMd: "Partage un lien réellement utile à l'équipe (article, outil, doc), avec une phrase de contexte." },
  { slug: "poll_lunch", tool: "slack", difficulty: 2, detection: "honor", params: {}, briefMd: "Lance un mini-sondage léger dans le canal d'équipe (déjeuner, café, playlist…). Fais voter au moins 2 personnes." },
  { slug: "emoji_streak_day", tool: "slack", difficulty: 2, detection: "auto", params: { emoji: "carrot", count: 5 }, briefMd: "Pose **5 réactions 🥕** dans la semaine, réparties sur au moins 2 jours." },
  { slug: "revive_old_thread", tool: "slack", difficulty: 2, detection: "honor", params: {}, briefMd: "Relance utilement un thread vieux de plus de 3 jours (une vraie relance, pas un « up »)." },

  // ============ SLACK — difficulté 3 ============
  { slug: "word_perissodactyle", tool: "slack", difficulty: 3, detection: "auto", params: { word: "périssodactyle" }, briefMd: "Place le mot **« périssodactyle »** dans une vraie conversation. Bonne chance, agent." },
  { slug: "word_crepuscule_x2", tool: "slack", difficulty: 3, detection: "auto", params: { word: "crépuscule", count: 2 }, briefMd: "Utilise **« crépuscule »** dans **2 messages distincts**, à au moins un jour d'écart." },
  { slug: "haiku_hidden", tool: "slack", difficulty: 3, detection: "honor", params: {}, briefMd: "Écris un message qui est secrètement un **haïku** (5-7-5). Personne ne doit le remarquer avant vendredi." },
  { slug: "alphabet_message", tool: "slack", difficulty: 3, detection: "honor", params: {}, briefMd: "Poste un message utile dont les **3 premières phrases commencent par A, B, C** dans l'ordre." },
  { slug: "five_reactions_one_message", tool: "slack", difficulty: 3, detection: "honor", params: {}, briefMd: "Obtiens **5 réactions** (de 5 personnes) sur un seul de tes messages. Sans demander." },
  { slug: "start_thread_10_replies", tool: "slack", difficulty: 3, detection: "honor", params: {}, briefMd: "Démarre une conversation qui atteint **10 réponses**. Le sujet est libre, le talent obligatoire." },

  // ============ NOTION — difficulté 1 ============
  { slug: "notion_emoji_page", tool: "notion", difficulty: 1, detection: "honor", params: {}, briefMd: "Change l'icône d'une page Notion que tu possèdes pour un emoji **animal**." },
  { slug: "notion_tidy_one", tool: "notion", difficulty: 1, detection: "honor", params: {}, briefMd: "Range ou renomme proprement **une page** Notion mal titrée. Le ménage discret, c'est ton art." },
  { slug: "notion_comment_nice", tool: "notion", difficulty: 1, detection: "honor", params: {}, briefMd: "Laisse un commentaire constructif sur la page Notion d'un collègue." },
  { slug: "notion_add_cover", tool: "notion", difficulty: 1, detection: "honor", params: {}, briefMd: "Ajoute une cover (image de couverture) à une page qui n'en a pas." },

  // ============ NOTION — difficulté 2 ============
  { slug: "notion_new_page", tool: "notion", difficulty: 2, detection: "auto", params: { kind: "page_created" }, briefMd: "Crée et publie une **nouvelle page Notion** utile (notes, doc, process) cette semaine." },
  { slug: "notion_word_lagon", tool: "notion", difficulty: 2, detection: "honor", params: { word: "lagon" }, briefMd: "Glisse le mot **« lagon »** dans une page ou un commentaire Notion." },
  { slug: "notion_checklist", tool: "notion", difficulty: 2, detection: "honor", params: {}, briefMd: "Transforme un paragraphe fouillis (le tien ou avec accord) en **checklist** propre." },
  { slug: "notion_template", tool: "notion", difficulty: 2, detection: "honor", params: {}, briefMd: "Crée un petit **template** réutilisable pour l'équipe (réunion, compte-rendu, etc.)." },
  { slug: "notion_link_pages", tool: "notion", difficulty: 2, detection: "honor", params: {}, briefMd: "Relie **2 pages** Notion existantes entre elles avec des mentions @page. La toile se tisse." },

  // ============ NOTION — difficulté 3 ============
  { slug: "notion_glossary", tool: "notion", difficulty: 3, detection: "honor", params: {}, briefMd: "Crée un mini **glossaire** (≥5 termes) du jargon de l'équipe. Quelqu'un doit le consulter avant vendredi." },
  { slug: "notion_archive_sweep", tool: "notion", difficulty: 3, detection: "honor", params: {}, briefMd: "Archive ou regroupe **3 pages obsolètes** (avec accord si besoin). Le grand ménage du fantôme." },
  { slug: "notion_faq", tool: "notion", difficulty: 3, detection: "honor", params: {}, briefMd: "Démarre une **FAQ d'équipe** avec au moins 3 vraies questions/réponses." },

  // ============ KANBAN — difficulté 1 ============
  { slug: "kanban_emoji_title", tool: "kanban", difficulty: 1, detection: "honor", params: {}, briefMd: "Ajoute un emoji pertinent au titre d'**un ticket** que tu possèdes." },
  { slug: "kanban_clean_one", tool: "kanban", difficulty: 1, detection: "honor", params: {}, briefMd: "Complète la description d'un ticket vide (le tien). Les détectives n'y verront que du feu." },
  { slug: "kanban_label_garden", tool: "kanban", difficulty: 1, detection: "honor", params: {}, briefMd: "Ajoute ou corrige les **labels** de 2 tickets. Jardinage de board." },

  // ============ KANBAN — difficulté 2 ============
  { slug: "kanban_close_ticket", tool: "kanban", difficulty: 2, detection: "auto", params: { kind: "issue_completed" }, briefMd: "Termine **un ticket** cette semaine (un vrai, pas un ticket créé pour l'occasion)." },
  { slug: "kanban_split_ticket", tool: "kanban", difficulty: 2, detection: "honor", params: {}, briefMd: "Découpe un gros ticket en **2 sous-tâches** claires." },
  { slug: "kanban_estimate_sweep", tool: "kanban", difficulty: 2, detection: "honor", params: {}, briefMd: "Estime ou ré-estime **3 tickets** du backlog. Ni vu ni connu." },
  { slug: "kanban_word_iceberg", tool: "kanban", difficulty: 2, detection: "honor", params: { word: "iceberg" }, briefMd: "Place le mot **« iceberg »** dans la description ou un commentaire d'un ticket." },

  // ============ KANBAN — difficulté 3 ============
  { slug: "kanban_two_closed", tool: "kanban", difficulty: 3, detection: "auto", params: { kind: "issue_completed", count: 2 }, briefMd: "Termine **2 tickets** cette semaine. Le Lapin le plus productif de l'Ouest." },
  { slug: "kanban_zombie_hunt", tool: "kanban", difficulty: 3, detection: "honor", params: {}, briefMd: "Identifie **3 tickets zombies** (>30 jours sans activité) et propose leur sort dans un commentaire." },

  // ============ ANY — difficulté 1 ============
  { slug: "any_compliment_tool", tool: "any", difficulty: 1, detection: "honor", params: {}, briefMd: "Dis du bien d'un outil de l'équipe (sincèrement) dans une conversation. N'importe lequel." },
  { slug: "any_tea_coffee", tool: "any", difficulty: 1, detection: "honor", params: {}, briefMd: "Propose un café/thé virtuel ou réel à un collègue avec qui tu parles peu." },
  { slug: "any_doc_typo", tool: "any", difficulty: 1, detection: "honor", params: {}, briefMd: "Corrige une coquille quelque part (doc, ticket, wiki). Le correcteur masqué frappe encore." },
  { slug: "any_share_win", tool: "any", difficulty: 1, detection: "honor", params: {}, briefMd: "Partage une petite victoire de la semaine (la tienne ou celle d'un collègue, avec son accord)." },

  // ============ ANY — difficulté 2 ============
  { slug: "any_meeting_idea", tool: "any", difficulty: 2, detection: "honor", params: {}, briefMd: "Propose **une idée concrète** en réunion ou par écrit cette semaine. Quelque chose d'actionnable." },
  { slug: "any_help_unasked", tool: "any", difficulty: 2, detection: "honor", params: {}, briefMd: "Aide un collègue sur un sujet **sans qu'il l'ait demandé** (revue, relecture, dépannage)." },
  { slug: "any_teach_trick", tool: "any", difficulty: 2, detection: "honor", params: {}, briefMd: "Apprends une astuce (raccourci, commande, outil) à quelqu'un. Le savoir se propage." },
  { slug: "any_two_tools_word", tool: "any", difficulty: 2, detection: "honor", params: { word: "archipel" }, briefMd: "Place le mot **« archipel »** dans **2 outils différents** (Slack + Notion, Slack + ticket…)." },
  { slug: "any_intro_two_people", tool: "any", difficulty: 2, detection: "honor", params: {}, briefMd: "Mets en relation 2 collègues qui devraient se parler sur un sujet précis." },

  // ============ ANY — difficulté 3 ============
  { slug: "any_mini_demo", tool: "any", difficulty: 3, detection: "honor", params: {}, briefMd: "Fais une **mini-démo** (≤5 min) de quelque chose que tu as fait, à au moins 2 personnes." },
  { slug: "any_process_fix", tool: "any", difficulty: 3, detection: "honor", params: {}, briefMd: "Identifie un petit irritant de process et **propose un correctif** par écrit. Diplomatie de lapin." },
  { slug: "any_silent_week_goal", tool: "any", difficulty: 3, detection: "honor", params: {}, briefMd: "Fixe-toi un objectif secret lundi, tiens-le toute la semaine, et révèle-le vendredi après le vote." },
  { slug: "any_three_kindness", tool: "any", difficulty: 3, detection: "honor", params: { count: 3 }, briefMd: "Accomplis **3 gentillesses discrètes** (3 jours différents). Si on te repère, c'est raté." },
  { slug: "any_lunch_organizer", tool: "any", difficulty: 3, detection: "honor", params: {}, briefMd: "Organise un moment d'équipe (déjeuner, pause, jeu) auquel ≥3 personnes participent." },
  { slug: "any_doc_rescue", tool: "any", difficulty: 3, detection: "honor", params: {}, briefMd: "Trouve une info importante qui n'est documentée nulle part et **documente-la** proprement." },
];

if (MISSIONS_BANK.length < 60) {
  // Garde-fou de build : la banque doit rester fournie pour éviter les répétitions.
  // (60 missions ≈ 8 semaines sans répétition avec 3 missions/semaine et de la marge.)
  throw new Error(`missions-bank: ${MISSIONS_BANK.length} missions, 60 attendues`);
}
