# Vietphrase ZXC - Chinese to Vietnamese Translation Tool

Vietphrase ZXC is a client-side web application for translating Chinese text to Vietnamese. It uses a dictionary-based approach with multiple dictionary files (Vietphrase, Names, HanViet/PhienAm, LuatNhan rules) stored locally in IndexedDB for fast lookups. The application runs entirely in the browser without requiring a server for translation operations.

The core functionality revolves around a Trie data structure for efficient longest-match word segmentation, priority-based dictionary lookups, and interactive UI for editing translations in real-time. Users can maintain custom name lists (for character names, proper nouns), apply temporary translations during a session, and export results to text files.

## Dictionary Management Module (m_dictionary.js)

### initializeDictionaries

Initializes and loads dictionaries from IndexedDB cache. Returns a Map of dictionaries with their priorities and lookup tables, or null if no cached data exists.

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
  console.log(`Priority: ${vietphraseDict.priority}`); // Higher = lower priority
} else {
  console.log('No cached dictionaries, please import dictionary files');
}
```

### loadDictionariesFromServer

Fetches dictionary files from the server's `/data/` directory, processes them using a Web Worker, and stores the parsed data in IndexedDB.

```javascript
import { loadDictionariesFromServer } from './m_dictionary.js';

// Log handler for progress updates
const logHandler = {
  append: (message, type) => {
    console.log(`[${type}] ${message}`);
    // types: 'loading', 'success', 'error', 'info', 'complete'
    return { id: Date.now() }; // Return log item reference
  },
  update: (logItem, message, type) => {
    console.log(`[${type}] Updated: ${message}`);
  }
};

try {
  // Automatically fetches: Vietphrase.txt, Names.txt, HanViet.txt, etc. from /data/
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

Processes user-uploaded dictionary files. Matches files by name to predefined dictionary configurations.

```javascript
import { loadDictionariesFromFile } from './m_dictionary.js';

// HTML: <input type="file" id="file-input" multiple accept=".txt">
const fileInput = document.getElementById('file-input');

fileInput.addEventListener('change', async (e) => {
  const files = e.target.files; // FileList with .txt files
  const currentDicts = new Map(); // Existing dictionaries or empty Map

  const logHandler = {
    append: (msg, type) => console.log(`[${type}] ${msg}`),
    update: (item, msg, type) => console.log(`[${type}] ${msg}`)
  };

  // Recognized file names:
  // - Vietphrase.txt, VP.txt - Main translation dictionary
  // - Names.txt, Name.txt - Proper nouns/character names
  // - HanViet.txt, PhienAm.txt - Sino-Vietnamese readings
  // - LuatNhan.txt - Pattern replacement rules
  // - Blacklist.txt - Words to ignore

  const dictionaries = await loadDictionariesFromFile(files, currentDicts, logHandler);
  console.log('Loaded dictionaries:', [...dictionaries.keys()]);
  // Output: Loaded dictionaries: ['Vietphrase', 'Names', 'PhienAm', ...]
});
```

### translateWord

Translates a single word/phrase using prioritized dictionary lookups. Returns the best match and all possible meanings.

```javascript
import { translateWord } from './m_dictionary.js';
import { nameDictionary, temporaryNameDictionary } from './m_nameList.js';

// Assume dictionaries are loaded
const word = '你好';
const result = translateWord(
  word,
  dictionaries,
  nameDictionary,      // User's custom name list
  temporaryNameDictionary, // Session-only translations
  false                // getAllMeanings flag
);

console.log(result);
// Output: { best: 'xin chào', all: ['xin chào', 'chào'], found: true }

// For unfound words:
const unknown = translateWord('未知词', dictionaries, nameDictionary, temporaryNameDictionary);
console.log(unknown);
// Output: { best: '未知词', all: [], found: false }
```

### getHanViet

Retrieves the Sino-Vietnamese (Hán Việt) reading for Chinese characters. Returns character-by-character phonetic transcription.

```javascript
import { getHanViet } from './m_dictionary.js';

const hanViet = getHanViet('中国人', dictionaries);
console.log(hanViet);
// Output: 'trung quốc nhân'

// Mixed content (Chinese + other characters)
const mixed = getHanViet('我是ABC', dictionaries);
console.log(mixed);
// Output: 'ngã thị ABC'
```

### segmentText

Segments Chinese text into words using longest-match algorithm with the master key set.

```javascript
import { segmentText } from './m_dictionary.js';

// masterKeySet contains all known words from all dictionaries
const text = '我今天很高兴';
const segments = segmentText(text, state.masterKeySet);

console.log(segments);
// Output: ['我', '今天', '很', '高兴']
// Segments matched against dictionary entries for optimal word boundaries
```

### getAllMeanings

Retrieves all available meanings from different dictionary sources for a word.

```javascript
import { getAllMeanings } from './m_dictionary.js';

const word = '李白';
const meanings = getAllMeanings(word, dictionaries, nameDictionary);

console.log(meanings);
/* Output:
{
  name: 'Lý Bạch',           // From user's Name List (highest priority)
  names: ['Lý Bạch'],        // From Names.txt
  names2: [],                // From Names2.txt
  vietphrase: ['lý bạch'],   // From Vietphrase.txt
  chapter: [],               // From Chapter number dictionary
  number: [],                // From Number dictionary
  hanviet: 'lý bạch'         // Sino-Vietnamese reading
}
*/
```

## Translation Module (m_translation.js)

### performTranslation

Main translation function that processes input text through multiple layers: name substitution, LuatNhan rules, word segmentation, and translation with proper formatting.

```javascript
import { performTranslation } from './m_translation.js';

// State object required by the translation system
const state = {
  dictionaries: loadedDictionaries, // Map of all dictionaries
  masterKeySet: allKeys,           // Set of all known Chinese words
  dictionaryTrie: trie,            // Trie structure for lookups
  lastTranslatedText: ''           // Stores last input for re-translation
};

// Standard translation from input textarea
performTranslation(state);
// Reads from DOMElements.inputText.value
// Writes HTML output to DOMElements.outputPanel

// Force translate specific text (useful for re-translation after edits)
performTranslation(state, {
  forceText: '这是一段中文文本',
  preserveTempDict: true  // Keep temporary translations
});

// The output HTML structure:
// <p>
//   <span class="word" data-original="这">đây</span>
//   <span class="word" data-original="是">là</span>
//   <span class="word from-name-dict" data-original="一段">một đoạn</span>
//   ...
// </p>
```

### synthesizeCompoundTranslation

Generates all possible translation combinations for compound words by combining meanings of individual segments.

```javascript
import { synthesizeCompoundTranslation } from './m_translation.js';

const text = '大家好';
const suggestions = synthesizeCompoundTranslation(text, state);

console.log(suggestions);
// Output: ['mọi người tốt', 'đại gia tốt', 'mọi người hay', ...]
// Returns up to 100 unique combinations for the quick edit panel
```

## Name List Module (m_nameList.js)

### nameDictionary and temporaryNameDictionary

Global Maps storing user's custom translations. `nameDictionary` persists to localStorage, while `temporaryNameDictionary` is session-only.

```javascript
import {
  nameDictionary,
  temporaryNameDictionary,
  saveNameDictionaryToStorage,
  renderNameList
} from './m_nameList.js';

// Add a permanent name (persists across sessions)
nameDictionary.set('李云龙', 'Lý Vân Long');
saveNameDictionaryToStorage();
renderNameList(); // Update UI textarea

// Add a temporary name (session only, for quick edits)
temporaryNameDictionary.set('张三', 'Trương Tam');

// Check if word is in name list
if (nameDictionary.has('李云龙')) {
  console.log('Found:', nameDictionary.get('李云龙')); // 'Lý Vân Long'
}
```

### initializeNameList

Initializes the name list system, loads from localStorage, sets up UI event handlers, and builds the master data structures.

```javascript
import { initializeNameList, rebuildMasterData } from './m_nameList.js';

// Call during application initialization
initializeNameList(state);

// Sets up:
// - Load name dictionary from localStorage
// - Sort dropdown handlers (newest, oldest, A-Z Vietnamese/Chinese)
// - Save, Delete, Export, Import button handlers
// - Auto-rebuild masterKeySet and Trie when names change
```

### rebuildMasterData

Rebuilds the masterKeySet and Trie data structures after dictionary changes. Essential for search performance.

```javascript
import { rebuildMasterData } from './m_nameList.js';

// After modifying dictionaries or name list
nameDictionary.set('新词', 'từ mới');
rebuildMasterData(state);

// The function:
// 1. Rebuilds masterKeySet with all dictionary keys
// 2. Rebuilds Trie with priority order:
//    NamesUser(0) > Names2(20) > Names(21) > LuatNhan(30) >
//    Vietphrase(40) > Chapter(41) > Number(42) > Pronouns(50) >
//    PhienAm(60) > English(98) > Blacklist(99)
```

## Text Preprocessing Module (m_preprocessor.js)

### standardizeText

Normalizes Chinese text by converting full-width characters to ASCII and standardizing punctuation.

```javascript
import { standardizeText } from './m_preprocessor.js';

const input = '你好！我叫张三。';
const standardized = standardizeText(input);
console.log(standardized);
// Output: '你好!我叫张三.'
// Converts: ！→! 。→. ，→, ：→: etc.

// Also removes extra spaces around punctuation
const messy = '你  好 ！  我 叫   张三 。';
console.log(standardizeText(messy));
// Output: '你好!我叫张三.'
```

### standardizeDictionaryLine

Normalizes dictionary entry lines while preserving the Vietnamese translation part.

```javascript
import { standardizeDictionaryLine } from './m_preprocessor.js';

// Standard dictionary line format: Chinese=Vietnamese
const line = '你好！=xin chào';
const standardized = standardizeDictionaryLine(line);
console.log(standardized);
// Output: '你好!=xin chào' (only Chinese part is normalized)

// Blacklist entries (no '=' sign)
const blacklistLine = '广告词！';
console.log(standardizeDictionaryLine(blacklistLine));
// Output: '广告词!'
```

## Modal and UI Module (m_modal.js)

### initializeModal

Initializes all interactive modal dialogs and UI event handlers for text selection, quick edit panels, and name editing.

```javascript
import { initializeModal } from './m_modal.js';

// Initialize after DOM is ready and dictionaries are loaded
initializeModal(state);

// Sets up:
// - Double-click on word: Opens full edit modal
// - Single click/selection: Opens quick edit panel
// - Expand selection left/right buttons
// - Temporary vs permanent name add buttons
// - Lock/pin panel functionality
// - Google Translate integration
// - Clipboard copy for Chinese text
```

## Dictionary File Format

Dictionary files use a simple key=value format with one entry per line.

```text
# Vietphrase.txt - Main translation dictionary
你好=xin chào
谢谢=cảm ơn
我=tôi/ta
今天=hôm nay

# Names.txt - Character names and proper nouns
李云龙=Lý Vân Long
张三=Trương Tam
北京=Bắc Kinh

# LuatNhan.txt - Pattern replacement rules (with {0} placeholder)
不比{0}强=không mạnh bằng {0}
对{0}说=nói với {0}

# Blacklist.txt - Words to ignore (no translation, removed from output)
广告
推荐阅读

# PhienAm.txt / HanViet.txt - Sino-Vietnamese readings (character by character)
中=trung
国=quốc
人=nhân
```

## Main Use Cases and Integration Patterns

The primary use case is translating Chinese novels, web novels, and other long-form Chinese text into Vietnamese. Users typically import their dictionary files (Vietphrase, Names, HanViet) either from local files or from the server, then paste or import Chinese text for translation. The interactive UI allows users to click on any translated word to see alternative meanings, add custom name translations, and refine the output in real-time without re-translating the entire document.

For integration, the application is designed as a standalone static website that can be hosted on any web server (uses GitHub Pages at vietphrase.zxc.io.vn). All dictionary processing happens client-side using Web Workers to prevent UI blocking. Data persistence uses IndexedDB for dictionaries (which can be tens of megabytes) and localStorage for user settings and name lists. The modular JavaScript architecture (ES6 modules) allows individual components to be imported and used independently, making it possible to build custom translation pipelines or embed the core translation logic in other applications.
