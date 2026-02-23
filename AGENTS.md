# Vietphrase ZXC - Chinese to Vietnamese Translation Tool

Vietphrase ZXC is a client-side web application for translating Chinese text to Vietnamese using a dictionary-based approach. The application runs entirely in the browser without requiring a server for translation operations, storing multiple dictionary files (Vietphrase, Names, HanViet/PhienAm, LuatNhan rules) locally in IndexedDB for fast lookups. It supports Chinese novel translation workflows with features like custom name lists, temporary session-based translations, and real-time interactive editing.

The core functionality revolves around a Trie data structure for efficient longest-match word segmentation, priority-based dictionary lookups (Names > Vietphrase > HanViet), and an interactive UI for editing translations in real-time. Users can maintain custom name lists for character names and proper nouns, apply temporary translations during a session, export results to text files, and benefit from automatic punctuation normalization and capitalization rules.

## Dictionary Management Module (m_dictionary.js)

### initializeDictionaries

Initializes and loads dictionaries from IndexedDB cache. Returns a Map of dictionaries with their priorities and lookup tables, or null if no cached data exists. Call this on application startup to restore previously imported dictionaries.

```javascript
import { initializeDictionaries } from './m_dictionary.js';

// Load dictionaries from IndexedDB on application startup
const dictionaries = await initializeDictionaries();

if (dictionaries) {
  console.log('Dictionaries loaded successfully');
  // dictionaries is a Map<string, {priority: number, dict: Map<string, string>}>
  // Available dictionaries: Vietphrase, Names, Names2, PhienAm, LuatNhan, etc.

  const vietphraseDict = dictionaries.get('Vietphrase');
  console.log(`Vietphrase entries: ${vietphraseDict.dict.size}`);
  console.log(`Priority: ${vietphraseDict.priority}`); // Higher number = lower priority

  // Check if a specific word exists
  if (vietphraseDict.dict.has('你好')) {
    console.log('Translation:', vietphraseDict.dict.get('你好')); // 'xin chào'
  }
} else {
  console.log('No cached dictionaries, please import dictionary files');
}
```

### loadDictionariesFromServer

Fetches dictionary files from the server's `/data/` directory, processes them using a Web Worker, and stores the parsed data in IndexedDB. Automatically looks for standard dictionary file names.

```javascript
import { loadDictionariesFromServer } from './m_dictionary.js';

// Log handler for progress updates displayed in modal
const logHandler = {
  append: (message, type) => {
    // types: 'loading', 'success', 'error', 'info', 'complete'
    const li = document.createElement('li');
    li.textContent = `[${type}] ${message}`;
    logList.appendChild(li);
    return li; // Return log item reference for updates
  },
  update: (logItem, message, type) => {
    logItem.textContent = `[${type}] ${message}`;
  }
};

try {
  // Automatically fetches from /data/ directory:
  // - Vietphrase.txt, VP.txt
  // - Names.txt, Name.txt, Names2.txt
  // - HanViet.txt, PhienAm.txt
  // - LuatNhan.txt
  // - Blacklist.txt, Pronouns.txt, etc.
  const dictionaries = await loadDictionariesFromServer(logHandler);

  if (dictionaries) {
    console.log('Server dictionaries loaded:', dictionaries.size, 'dictionaries');
    // Output: Server dictionaries loaded: 10 dictionaries
  }
} catch (error) {
  console.error('Failed to load dictionaries:', error.message);
}
```

### loadDictionariesFromFile

Processes user-uploaded dictionary files from a file input. Matches files by name to predefined dictionary configurations and merges with existing dictionaries.

```javascript
import { loadDictionariesFromFile } from './m_dictionary.js';

// HTML: <input type="file" id="file-input" multiple accept=".txt">
const fileInput = document.getElementById('file-input');

fileInput.addEventListener('change', async (e) => {
  const files = e.target.files; // FileList with .txt files
  const currentDicts = state.dictionaries || new Map();

  const logHandler = {
    append: (msg, type) => { console.log(`[${type}] ${msg}`); return {}; },
    update: (item, msg, type) => console.log(`[${type}] ${msg}`)
  };

  // Recognized file names (case-insensitive):
  // - Vietphrase.txt, VP.txt - Main translation dictionary
  // - Names.txt, Name.txt - Proper nouns/character names
  // - Names2.txt, Name2.txt - Secondary names dictionary
  // - HanViet.txt, PhienAm.txt - Sino-Vietnamese readings
  // - LuatNhan.txt - Pattern replacement rules
  // - Blacklist.txt, IgnoreList.txt - Words to ignore
  // - Pronouns.txt, DaiTuNhanXung.txt - Pronouns
  // - Chapter.txt, Number.txt - Chapter/number translations

  const dictionaries = await loadDictionariesFromFile(files, currentDicts, logHandler);
  console.log('Loaded dictionaries:', [...dictionaries.keys()]);
  // Output: Loaded dictionaries: ['Vietphrase', 'Names', 'PhienAm', ...]
});
```

### loadSingleDictionaryFromFile

Loads a single dictionary file with explicit type specification. Useful for updating just one dictionary without re-importing all files.

```javascript
import { loadSingleDictionaryFromFile } from './m_dictionary.js';

// For single dictionary import buttons
const singleFileInput = document.getElementById('single-file-importer');

async function importSingleDictionary(file, dictionaryType) {
  // dictionaryType: 'Vietphrase', 'Names', 'PhienAm', 'LuatNhan', etc.
  const logHandler = {
    append: (msg, type) => { console.log(`[${type}] ${msg}`); return {}; },
    update: (item, msg, type) => console.log(`[${type}] ${msg}`)
  };

  const currentDicts = state.dictionaries || new Map();
  const newDicts = await loadSingleDictionaryFromFile(
    file,
    dictionaryType, // e.g., 'Names'
    currentDicts,
    logHandler
  );

  if (newDicts) {
    console.log(`Successfully imported ${dictionaryType}`);
    return newDicts;
  }
}
```

### translateWord

Translates a single word/phrase using prioritized dictionary lookups. Returns the best match and all possible meanings with source information.

```javascript
import { translateWord } from './m_dictionary.js';
import { nameDictionary, temporaryNameDictionary } from './m_nameList.js';

// Basic translation lookup
const word = '你好';
const result = translateWord(
  word,
  dictionaries,             // Loaded dictionaries Map
  nameDictionary,           // User's custom name list (Map)
  temporaryNameDictionary,  // Session-only translations (Map)
  false                     // getAllMeanings flag (unused)
);

console.log(result);
// Output: { best: 'xin chào', all: ['xin chào', 'chào'], found: true }

// For words with multiple meanings separated by / or ;
const multiMeaning = translateWord('我', dictionaries, nameDictionary, temporaryNameDictionary);
console.log(multiMeaning);
// Output: { best: 'tôi', all: ['tôi', 'ta', 'mình'], found: true }

// For unknown words (not in any dictionary)
const unknown = translateWord('未知词汇', dictionaries, nameDictionary, temporaryNameDictionary);
console.log(unknown);
// Output: { best: '未知词汇', all: [], found: false }
```

### getHanViet

Retrieves the Sino-Vietnamese (Han Viet) reading for Chinese characters. Returns character-by-character phonetic transcription, preserving non-Chinese characters.

```javascript
import { getHanViet } from './m_dictionary.js';

// Basic Sino-Vietnamese reading
const hanViet = getHanViet('中国人', dictionaries);
console.log(hanViet);
// Output: 'trung quoc nhan'

// Mixed content (Chinese + other characters preserved)
const mixed = getHanViet('我是ABC123', dictionaries);
console.log(mixed);
// Output: 'nga thi ABC123'

// Long phrase
const phrase = getHanViet('天下无敌', dictionaries);
console.log(phrase);
// Output: 'thien ha vo dich'

// Used in quick edit panel to show HV reading
document.getElementById('hanviet-input').value = getHanViet(selectedWord, dictionaries) || '';
```

### segmentText

Segments Chinese text into words using longest-match algorithm with the master key set containing all known dictionary words.

```javascript
import { segmentText } from './m_dictionary.js';

// masterKeySet is a Set containing all known words from all dictionaries
const text = '我今天很高兴见到你';
const segments = segmentText(text, state.masterKeySet);

console.log(segments);
// Output: ['我', '今天', '很', '高兴', '见到', '你']
// Segments are matched against dictionary entries for optimal word boundaries

// With mixed content
const mixedText = '我有100元';
const mixedSegments = segmentText(mixedText, state.masterKeySet);
console.log(mixedSegments);
// Output: ['我', '有', '100元'] or ['我', '有', '100', '元'] depending on dictionary
```

### getAllMeanings

Retrieves all available meanings from different dictionary sources for a word. Useful for displaying all translation options in edit panels.

```javascript
import { getAllMeanings } from './m_dictionary.js';

const word = '李白';
const meanings = getAllMeanings(word, dictionaries, nameDictionary);

console.log(meanings);
/* Output:
{
  name: 'Ly Bach',           // From user's Name List (highest priority)
  names: ['Ly Bach'],        // From Names.txt
  names2: [],                // From Names2.txt
  vietphrase: ['ly bach'],   // From Vietphrase.txt
  chapter: [],               // From Chapter number dictionary
  number: [],                // From Number dictionary
  hanviet: 'ly bach'         // Sino-Vietnamese reading
}
*/

// Use in UI to populate dropdown with all options
const allOptions = new Set();
if (meanings.name) allOptions.add(meanings.name);
meanings.names.forEach(m => allOptions.add(m));
meanings.vietphrase.forEach(m => allOptions.add(m));
// Display allOptions in dropdown
```

### clearAllDictionaries

Clears all stored dictionaries from IndexedDB. Useful for resetting the application or freeing storage space.

```javascript
import { clearAllDictionaries } from './m_dictionary.js';

// Clear all dictionaries after user confirmation
if (await customConfirm('Delete all dictionaries? This cannot be undone.')) {
  await clearAllDictionaries();
  console.log('All dictionaries cleared');
  location.reload(); // Reload to reset application state
}
```

## Translation Module (m_translation.js)

### performTranslation

Main translation function that processes input text through multiple layers: name substitution with placeholders, LuatNhan pattern rules, word segmentation, translation with smart spacing, and automatic capitalization.

```javascript
import { performTranslation } from './m_translation.js';

// State object required by the translation system
const state = {
  dictionaries: loadedDictionaries,  // Map of all dictionaries
  masterKeySet: allKeys,             // Set of all known Chinese words
  dictionaryTrie: trie,              // Trie structure for fast lookups
  lastTranslatedText: ''             // Stores last input for re-translation
};

// Standard translation from input textarea
// Reads from DOMElements.inputText.value
// Writes HTML output to DOMElements.outputPanel
performTranslation(state);

// Force translate specific text (useful for re-translation after name edits)
performTranslation(state, {
  forceText: '这是一段中文文本',
  preserveTempDict: true  // Keep temporary translations between calls
});

// The output HTML structure with interactive spans:
// <p>
//   <span class="word" data-original="这">day</span>
//   <span class="word" data-original="是">la</span>
//   <span class="word from-name-dict" data-original="张三">Truong Tam</span>
//   <span class="word untranslatable" data-original="未知"></span>
// </p>

// Vietphrase mode (show all meanings)
DOMElements.modeToggle.checked = true;
performTranslation(state);
// Output: (toi/ta/minh) (la) (nguoi/nhan) ...
```

### synthesizeCompoundTranslation

Generates all possible translation combinations for compound words by combining meanings of individual segments. Used in the quick edit panel to suggest translations.

```javascript
import { synthesizeCompoundTranslation } from './m_translation.js';

const text = '大家好';
const suggestions = synthesizeCompoundTranslation(text, state);

console.log(suggestions);
// Output: ['moi nguoi tot', 'dai gia tot', 'moi nguoi hay', ...]
// Returns up to 100 unique combinations

// Handle long inputs (limited to 7 segments)
const longText = '这是一个很长很长的句子';
const longSuggestions = synthesizeCompoundTranslation(longText, state);
console.log(longSuggestions);
// Output: ['这是一个很长很长的句子 - Qua dai de goi y']

// Use in quick edit panel
const editSuggestions = synthesizeCompoundTranslation(selectedText, state);
editSuggestions.forEach(suggestion => {
  // Add to dropdown options
});
```

## Name List Module (m_nameList.js)

### nameDictionary and temporaryNameDictionary

Global Maps storing user's custom translations. `nameDictionary` persists to localStorage across sessions, while `temporaryNameDictionary` is cleared on each translation.

```javascript
import {
  nameDictionary,
  temporaryNameDictionary,
  saveNameDictionaryToStorage,
  renderNameList
} from './m_nameList.js';

// Add a permanent name (persists across browser sessions)
nameDictionary.set('李云龙', 'Ly Van Long');
nameDictionary.set('赵刚', 'Trieu Cuong');
saveNameDictionaryToStorage(); // Save to localStorage
renderNameList(); // Update UI textarea

// Add a temporary name (session only, for quick corrections)
temporaryNameDictionary.set('张三', 'Truong Tam');
// Will be used in translation but cleared after performTranslation()

// Check if word exists in name list
if (nameDictionary.has('李云龙')) {
  console.log('Found:', nameDictionary.get('李云龙')); // 'Ly Van Long'
}

// Delete from name list
nameDictionary.delete('赵刚');
saveNameDictionaryToStorage();
renderNameList();
```

### initializeNameList

Initializes the name list system: loads from localStorage, sets up UI event handlers for sorting/save/delete/import/export, and builds master data structures.

```javascript
import { initializeNameList } from './m_nameList.js';

// Call during application initialization after DOM is ready
initializeNameList(state);

// This sets up:
// - Load name dictionary from localStorage
// - Sort dropdown handlers (newest, oldest, A-Z Vietnamese, A-Z Chinese)
// - Save button: parse textarea and save to localStorage
// - Delete button: clear entire name list
// - Export button: download as NamesUser.txt
// - Import button: load from .txt file and merge
// - Auto-rebuild masterKeySet and Trie when names change
// - Auto-retranslate when name list is modified
```

### rebuildMasterData

Rebuilds the masterKeySet and Trie data structures after dictionary changes. Called automatically when name list changes, but can be called manually after programmatic dictionary modifications.

```javascript
import { rebuildMasterData } from './m_nameList.js';

// After modifying dictionaries or name list programmatically
nameDictionary.set('新词', 'tu moi');
rebuildMasterData(state);

// The function rebuilds:
// 1. masterKeySet - Set of all Chinese words from all sources
// 2. dictionaryTrie - Trie with priority order:
//    NamesUser(0) > Names2(20) > Names(21) > LuatNhan(30) >
//    Vietphrase(40) > Chapter(41) > Number(42) > Pronouns(50) >
//    PhienAm(60) > English(98) > Blacklist(99)

// Lower priority number = higher precedence in translation
```

### renderNameList

Renders the name dictionary to the UI textarea with optional sorting.

```javascript
import { renderNameList } from './m_nameList.js';

// Render with default sort (newest first - insertion order)
renderNameList();

// Render with specific sort
renderNameList('oldest');   // Oldest first
renderNameList('vn-az');    // Vietnamese name A-Z
renderNameList('vn-za');    // Vietnamese name Z-A
renderNameList('cn-az');    // Chinese key A-Z
renderNameList('cn-za');    // Chinese key Z-A

// Output format in textarea:
// 李云龙=Ly Van Long
// 赵刚=Trieu Cuong
// 张三=Truong Tam
```

## Text Preprocessing Module (m_preprocessor.js)

### standardizeText

Normalizes Chinese text by removing extra spaces around punctuation and converting full-width/Chinese punctuation to ASCII equivalents.

```javascript
import { standardizeText } from './m_preprocessor.js';

// Normalize punctuation
const input = '你好！我叫张三。';
const standardized = standardizeText(input);
console.log(standardized);
// Output: '你好!我叫张三.'
// Converts: ！→! 。→. ，→, ：→: ；→; ？→? ～→~

// Remove extra spaces around punctuation
const messy = '你  好 ！  我 叫   张三 。';
console.log(standardizeText(messy));
// Output: '你好!我叫张三.'

// Full-width to half-width conversion
const fullWidth = '（你好）【重要】';
console.log(standardizeText(fullWidth));
// Output: '(你好)[重要]'

// Preserved characters (Chinese quotes for dialogue)
const dialogue = '他说：「你好」';
console.log(standardizeText(dialogue));
// Output: '他说:「你好」' (「」 preserved, ： converted)
```

### standardizeDictionaryLine

Normalizes dictionary entry lines while preserving the Vietnamese translation part. Used when parsing dictionary files.

```javascript
import { standardizeDictionaryLine } from './m_preprocessor.js';

// Standard dictionary line format: Chinese=Vietnamese
const line = '你好！=xin chao';
const standardized = standardizeDictionaryLine(line);
console.log(standardized);
// Output: '你好!=xin chao' (only Chinese part is normalized)

// Preserve Vietnamese side completely
const withSpecial = '什么？=cai gi?';
console.log(standardizeDictionaryLine(withSpecial));
// Output: '什么?=cai gi?' (Vietnamese "?" preserved as-is)

// Blacklist entries (no '=' sign) - entire line normalized
const blacklistLine = '广告词！';
console.log(standardizeDictionaryLine(blacklistLine));
// Output: '广告词!'

// Comment lines preserved
const comment = '# This is a comment';
console.log(standardizeDictionaryLine(comment));
// Output: '# This is a comment'
```

## Modal and UI Module (m_modal.js)

### initializeModal

Initializes all interactive modal dialogs and UI event handlers for text selection, quick edit panels, and name editing functionality.

```javascript
import { initializeModal } from './m_modal.js';

// Initialize after DOM is ready and dictionaries are loaded
initializeModal(state);

// This sets up the following interactions:
// - Single click/selection on output panel: Opens quick edit panel
// - Double-click on word: Opens full edit modal (via quick edit)
// - Expand selection left/right buttons
// - Quick add buttons (temporary, permanent)
// - Lock/pin panel functionality (persists across sessions)
// - Delete from name list button
// - Case transformation buttons (capitalize, uppercase, etc.)
// - Google Translate search button
// - Clipboard copy for Chinese text

// The quick edit panel shows:
// - hv: Han Viet (lowercase)
// - HV: Han Viet (uppercase)
// - zw: Original Chinese text
// - Vp: Vietphrase meaning
// - tc: Custom input field
```

### Trie Class

Internal Trie data structure used for efficient longest-match word lookup during translation. Exposed through the nameList module.

```javascript
// Trie is used internally but understanding its structure helps with debugging

// The Trie stores words with associated metadata
class Trie {
  insert(key, value, overwrite = false) {
    // Inserts Chinese word as key with translation metadata as value
    // value = { translation: string, type: string, ruleKey: string }
  }

  findLongestMatch(text, startIndex) {
    // Returns longest matching word starting at startIndex
    // Returns: { key: '中国', value: { translation: '...' } } or null
  }
}

// Used during translation to find longest dictionary matches
const match = state.dictionaryTrie.findLongestMatch('我是中国人', 2);
console.log(match);
// Output: { key: '中国人', value: { translation: 'nguoi Trung Quoc', type: 'Names' } }
```

## Dictionary File Format

Dictionary files use a simple key=value format with one entry per line. Multiple meanings are separated by `/` or `;`.

```text
# Vietphrase.txt - Main translation dictionary
# Format: Chinese=Vietnamese (multiple meanings separated by / or ;)
你好=xin chao
谢谢=cam on
我=toi/ta/minh
今天=hom nay
什么=cai gi/gi

# Names.txt - Character names and proper nouns (higher priority than Vietphrase)
李云龙=Ly Van Long
张三=Truong Tam
北京=Bac Kinh
中国=Trung Quoc

# LuatNhan.txt - Pattern replacement rules with {0} placeholder
# {0} captures Chinese text which is then translated
不比{0}强=khong manh bang {0}
对{0}说=noi voi {0}
把{0}放下=dat {0} xuong

# Blacklist.txt - Words to ignore (removed from output, no translation shown)
# No = sign needed, one entry per line
广告
推荐阅读
本章未完

# PhienAm.txt / HanViet.txt - Sino-Vietnamese readings (character by character)
# Used for generating phonetic readings
中=trung
国=quoc
人=nhan
我=nga

# Pronouns.txt - Personal pronouns
他=han/y
她=nang/co ay
你=nguoi/anh/em
```

## Application State Object

The state object is passed to most functions and contains the runtime data structures.

```javascript
// Initialize state on application startup
const state = {
  dictionaries: null,           // Map<string, {priority: number, dict: Map}>
  masterKeySet: new Set(),      // Set of all known Chinese words
  dictionaryTrie: null,         // Trie for fast lookups
  lastTranslatedText: ''        // For re-translation after edits
};

// After loading dictionaries
const db = await initializeDictionaries();
if (db) {
  state.dictionaries = db;
  rebuildMasterData(state);  // Builds masterKeySet and dictionaryTrie
}

// State is modified by:
// - initializeDictionaries() - sets dictionaries
// - rebuildMasterData() - sets masterKeySet, dictionaryTrie
// - performTranslation() - sets lastTranslatedText
```

## Main Use Cases and Integration Patterns

The primary use case is translating Chinese novels, web novels, and other long-form Chinese text into Vietnamese. Users typically import their dictionary files (Vietphrase, Names, HanViet) either from local files or from the server's `/data/` directory, then paste or import Chinese text for translation. The interactive UI allows users to click on any translated word to see alternative meanings, add custom name translations for character names that persist across sessions, apply quick temporary translations during editing, and export the final translation to text files.

For integration, the application is designed as a standalone static website that can be hosted on any web server (currently deployed on GitHub Pages at vietphrase.zxc.io.vn). All dictionary processing happens client-side using Web Workers to prevent UI blocking during the parsing of large dictionary files. Data persistence uses IndexedDB for dictionaries (which can be tens of megabytes for comprehensive Vietphrase databases) and localStorage for user settings, name lists, and input text preservation. The modular ES6 JavaScript architecture allows individual components to be imported independently, enabling custom translation pipelines or embedding the core translation logic (`translateWord`, `segmentText`, `getHanViet`) in other applications such as browser extensions or Electron apps.
