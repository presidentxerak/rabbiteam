/**
 * Editorial bank of the Rabbit's missions (~60).
 * TypeScript source of truth; the SQL seed (supabase/migrations/0002_seed.sql)
 * is generated from here and must stay in sync.
 *
 * detection 'auto'  : the Slack/Notion/Kanban handler detects completion.
 * detection 'honor' : the Rabbit checks it off via the button in their DM.
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
  // ============ SLACK - difficulty 1 ============
  { slug: "carrot_react_3", tool: "slack", difficulty: 1, detection: "auto", params: { emoji: "carrot", count: 3 }, briefMd: "React with 🥕 in **3 different threads** before Friday. Casually." },
  { slug: "hands_react_2", tool: "slack", difficulty: 1, detection: "auto", params: { emoji: "raised_hands", count: 2 }, briefMd: "Drop a 🙌 on **2 different colleagues' messages**. Be generous, not suspicious." },
  { slug: "gif_friday_vibes", tool: "slack", difficulty: 1, detection: "honor", params: {}, briefMd: "Post a GIF (any one) in a public channel. Just one. Well chosen." },
  { slug: "emoji_in_status", tool: "slack", difficulty: 1, detection: "honor", params: {}, briefMd: "Put a **vegetable** emoji in your Slack status for at least a day." },
  { slug: "thank_someone", tool: "slack", difficulty: 1, detection: "honor", params: {}, briefMd: "Publicly thank a colleague for something specific. Sincerity is your cover." },
  { slug: "purple_heart_2", tool: "slack", difficulty: 1, detection: "auto", params: { emoji: "purple_heart", count: 2 }, briefMd: "Leave a 💜 on **2 messages** from different people." },
  { slug: "ask_question_channel", tool: "slack", difficulty: 1, detection: "honor", params: {}, briefMd: "Ask a real question in a channel you haven't posted in this week." },
  { slug: "morning_greeting", tool: "slack", difficulty: 1, detection: "honor", params: {}, briefMd: "Wish the team a good day one morning, with a sun emoji. Natural." },

  // ============ SLACK - difficulty 2 ============
  { slug: "word_constellation", tool: "slack", difficulty: 2, detection: "auto", params: { word: "constellation" }, briefMd: "Slip the word **“constellation”** into a real Slack conversation. Without it seeming weird." },
  { slug: "word_phare", tool: "slack", difficulty: 2, detection: "auto", params: { word: "lighthouse" }, briefMd: "Drop the word **“lighthouse”** into a public channel message. Credible context required." },
  { slug: "word_boussole", tool: "slack", difficulty: 2, detection: "auto", params: { word: "compass" }, briefMd: "Use the word **“compass”** in a team discussion. Smoothly." },
  { slug: "word_marmotte", tool: "slack", difficulty: 2, detection: "auto", params: { word: "groundhog" }, briefMd: "Place **“groundhog”** in a conversation. Yes, it's hard. That's the game." },
  { slug: "three_threads_replies", tool: "slack", difficulty: 2, detection: "auto", params: { count: 3, kind: "thread_reply" }, briefMd: "Reply in **3 different threads** you didn't start, on the same day." },
  { slug: "compliment_chain", tool: "slack", difficulty: 2, detection: "honor", params: {}, briefMd: "Compliment the work of **2 colleagues** in 2 different channels, on the same day." },
  { slug: "share_useful_link", tool: "slack", difficulty: 2, detection: "honor", params: {}, briefMd: "Share a genuinely useful link with the team (article, tool, doc), with a line of context." },
  { slug: "poll_lunch", tool: "slack", difficulty: 2, detection: "honor", params: {}, briefMd: "Run a light mini-poll in the team channel (lunch, coffee, playlist…). Get at least 2 people to vote." },
  { slug: "emoji_streak_day", tool: "slack", difficulty: 2, detection: "auto", params: { emoji: "carrot", count: 5 }, briefMd: "Drop **5 🥕 reactions** during the week, spread across at least 2 days." },
  { slug: "revive_old_thread", tool: "slack", difficulty: 2, detection: "honor", params: {}, briefMd: "Usefully revive a thread older than 3 days (a real revival, not a “bump”)." },

  // ============ SLACK - difficulty 3 ============
  { slug: "word_perissodactyle", tool: "slack", difficulty: 3, detection: "auto", params: { word: "perissodactyl" }, briefMd: "Place the word **“perissodactyl”** in a real conversation. Good luck, agent." },
  { slug: "word_crepuscule_x2", tool: "slack", difficulty: 3, detection: "auto", params: { word: "twilight", count: 2 }, briefMd: "Use **“twilight”** in **2 separate messages**, at least a day apart." },
  { slug: "haiku_hidden", tool: "slack", difficulty: 3, detection: "honor", params: {}, briefMd: "Write a message that is secretly a **haiku** (5-7-5). No one should notice before Friday." },
  { slug: "alphabet_message", tool: "slack", difficulty: 3, detection: "honor", params: {}, briefMd: "Post a useful message whose **first 3 sentences start with A, B, C** in order." },
  { slug: "five_reactions_one_message", tool: "slack", difficulty: 3, detection: "honor", params: {}, briefMd: "Get **5 reactions** (from 5 people) on a single one of your messages. Without asking." },
  { slug: "start_thread_10_replies", tool: "slack", difficulty: 3, detection: "honor", params: {}, briefMd: "Start a conversation that reaches **10 replies**. Topic is free, talent is mandatory." },

  // ============ NOTION - difficulty 1 ============
  { slug: "notion_emoji_page", tool: "notion", difficulty: 1, detection: "honor", params: {}, briefMd: "Change the icon of a Notion page you own to an **animal** emoji." },
  { slug: "notion_tidy_one", tool: "notion", difficulty: 1, detection: "honor", params: {}, briefMd: "Tidy or cleanly rename **one** badly-titled Notion page. Quiet housekeeping is your art." },
  { slug: "notion_comment_nice", tool: "notion", difficulty: 1, detection: "honor", params: {}, briefMd: "Leave a constructive comment on a colleague's Notion page." },
  { slug: "notion_add_cover", tool: "notion", difficulty: 1, detection: "honor", params: {}, briefMd: "Add a cover image to a page that doesn't have one." },

  // ============ NOTION - difficulty 2 ============
  { slug: "notion_new_page", tool: "notion", difficulty: 2, detection: "auto", params: { kind: "page_created" }, briefMd: "Create and publish a **new, useful Notion page** (notes, doc, process) this week." },
  { slug: "notion_word_lagon", tool: "notion", difficulty: 2, detection: "honor", params: { word: "lagoon" }, briefMd: "Slip the word **“lagoon”** into a Notion page or comment." },
  { slug: "notion_checklist", tool: "notion", difficulty: 2, detection: "honor", params: {}, briefMd: "Turn a messy paragraph (yours, or with consent) into a clean **checklist**." },
  { slug: "notion_template", tool: "notion", difficulty: 2, detection: "honor", params: {}, briefMd: "Create a small reusable **template** for the team (meeting, report, etc.)." },
  { slug: "notion_link_pages", tool: "notion", difficulty: 2, detection: "honor", params: {}, briefMd: "Link **2 existing** Notion pages together with @page mentions. The web is woven." },

  // ============ NOTION - difficulty 3 ============
  { slug: "notion_glossary", tool: "notion", difficulty: 3, detection: "honor", params: {}, briefMd: "Create a mini **glossary** (≥5 terms) of the team's jargon. Someone must read it before Friday." },
  { slug: "notion_archive_sweep", tool: "notion", difficulty: 3, detection: "honor", params: {}, briefMd: "Archive or merge **3 obsolete pages** (with consent if needed). The ghost's big cleanup." },
  { slug: "notion_faq", tool: "notion", difficulty: 3, detection: "honor", params: {}, briefMd: "Start a team **FAQ** with at least 3 real questions and answers." },

  // ============ KANBAN - difficulty 1 ============
  { slug: "kanban_emoji_title", tool: "kanban", difficulty: 1, detection: "honor", params: {}, briefMd: "Add a relevant emoji to the title of **one ticket** you own." },
  { slug: "kanban_clean_one", tool: "kanban", difficulty: 1, detection: "honor", params: {}, briefMd: "Fill in the description of an empty ticket (yours). The detectives won't see a thing." },
  { slug: "kanban_label_garden", tool: "kanban", difficulty: 1, detection: "honor", params: {}, briefMd: "Add or fix the **labels** on 2 tickets. Board gardening." },

  // ============ KANBAN - difficulty 2 ============
  { slug: "kanban_close_ticket", tool: "kanban", difficulty: 2, detection: "auto", params: { kind: "issue_completed" }, briefMd: "Close **one ticket** this week (a real one, not a ticket made for the occasion)." },
  { slug: "kanban_split_ticket", tool: "kanban", difficulty: 2, detection: "honor", params: {}, briefMd: "Split a big ticket into **2 clear subtasks**." },
  { slug: "kanban_estimate_sweep", tool: "kanban", difficulty: 2, detection: "honor", params: {}, briefMd: "Estimate or re-estimate **3 tickets** in the backlog. No one the wiser." },
  { slug: "kanban_word_iceberg", tool: "kanban", difficulty: 2, detection: "honor", params: { word: "iceberg" }, briefMd: "Place the word **“iceberg”** in a ticket description or comment." },

  // ============ KANBAN - difficulty 3 ============
  { slug: "kanban_two_closed", tool: "kanban", difficulty: 3, detection: "auto", params: { kind: "issue_completed", count: 2 }, briefMd: "Close **2 tickets** this week. The most productive Rabbit in the West." },
  { slug: "kanban_zombie_hunt", tool: "kanban", difficulty: 3, detection: "honor", params: {}, briefMd: "Identify **3 zombie tickets** (>30 days with no activity) and propose their fate in a comment." },

  // ============ ANY - difficulty 1 ============
  { slug: "any_compliment_tool", tool: "any", difficulty: 1, detection: "honor", params: {}, briefMd: "Say something nice (sincerely) about a team tool in a conversation. Any tool." },
  { slug: "any_tea_coffee", tool: "any", difficulty: 1, detection: "honor", params: {}, briefMd: "Offer a virtual or real coffee/tea to a colleague you rarely talk to." },
  { slug: "any_doc_typo", tool: "any", difficulty: 1, detection: "honor", params: {}, briefMd: "Fix a typo somewhere (doc, ticket, wiki). The masked proofreader strikes again." },
  { slug: "any_share_win", tool: "any", difficulty: 1, detection: "honor", params: {}, briefMd: "Share a small win of the week (yours, or a colleague's with their consent)." },

  // ============ ANY - difficulty 2 ============
  { slug: "any_meeting_idea", tool: "any", difficulty: 2, detection: "honor", params: {}, briefMd: "Propose **one concrete idea** in a meeting or in writing this week. Something actionable." },
  { slug: "any_help_unasked", tool: "any", difficulty: 2, detection: "honor", params: {}, briefMd: "Help a colleague on something **without them asking** (review, proofread, troubleshooting)." },
  { slug: "any_teach_trick", tool: "any", difficulty: 2, detection: "honor", params: {}, briefMd: "Teach someone a trick (shortcut, command, tool). Knowledge spreads." },
  { slug: "any_two_tools_word", tool: "any", difficulty: 2, detection: "honor", params: { word: "archipelago" }, briefMd: "Place the word **“archipelago”** in **2 different tools** (Slack + Notion, Slack + ticket…)." },
  { slug: "any_intro_two_people", tool: "any", difficulty: 2, detection: "honor", params: {}, briefMd: "Connect 2 colleagues who should talk about a specific topic." },

  // ============ ANY - difficulty 3 ============
  { slug: "any_mini_demo", tool: "any", difficulty: 3, detection: "honor", params: {}, briefMd: "Give a **mini-demo** (≤5 min) of something you made, to at least 2 people." },
  { slug: "any_process_fix", tool: "any", difficulty: 3, detection: "honor", params: {}, briefMd: "Spot a small process annoyance and **propose a fix** in writing. Rabbit diplomacy." },
  { slug: "any_silent_week_goal", tool: "any", difficulty: 3, detection: "honor", params: {}, briefMd: "Set yourself a secret goal Monday, hold it all week, and reveal it Friday after the vote." },
  { slug: "any_three_kindness", tool: "any", difficulty: 3, detection: "honor", params: { count: 3 }, briefMd: "Do **3 discreet kind acts** (on 3 different days). If you're spotted, it doesn't count." },
  { slug: "any_lunch_organizer", tool: "any", difficulty: 3, detection: "honor", params: {}, briefMd: "Organize a team moment (lunch, break, game) that ≥3 people join." },
  { slug: "any_doc_rescue", tool: "any", difficulty: 3, detection: "honor", params: {}, briefMd: "Find an important piece of info that's documented nowhere and **document it** cleanly." },
];

if (MISSIONS_BANK.length < 60) {
  // Build guard: the bank must stay well-stocked to avoid repetitions.
  // (60 missions ≈ 8 weeks with no repeat at 3 missions/week, with margin.)
  throw new Error(`missions-bank: ${MISSIONS_BANK.length} missions, expected 60`);
}
