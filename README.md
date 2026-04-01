# Japanese Learning Hub

A **Single Page Application (SPA)** specifically designed for practicing Japanese language skills, focusing on both writing (Kanji) and typing (Vocabulary) recognition.

## 🚀 Key Features

### ✍️ Kanji Practice
Interactive handwriting practice powered by **Hanzi Writer**. 
- **Stroke Order Detection:** Real-time feedback on stroke direction and order.
- **Blind Mode:** Challenge your memory by hiding character outlines, forcing you to recall the kanji structure from scratch.
- **Lesson-Based Learning:** Practice Kanji specifically from Minna no Nihongo (e.g., Lesson 26, 27).

### ⌨️ Typing Practice
Reinforce your vocabulary through active recall.
- **Hiragana/Katakana Typing:** Practice typing the readings and meanings of vocabulary words.
- **Real-time Validation:** Immediate feedback on typing accuracy to improve speed and recognition.

### 🏠 Home Dashboard
- **Centralized Navigation:** A clean and modern hub to easily switch between Writing and Typing modes.
- **Progressive UI:** Designed for a seamless learning experience without page reloads.

## 🛠 Technology Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Libraries:** - [Hanzi Writer](https://chanind.github.io/hanzi-writer/) - For handwriting recognition and stroke animations.
- **Typography:** - **Chakra Petch:** For a modern, tech-focused Thai/English interface.
  - **Noto Sans JP:** Optimized for clear and readable Japanese characters.
- **Data Structure:** JSON-based vocabulary and Kanji management (supporting Minna no Nihongo curriculum).

## 📁 Data Structure Example
The application utilizes a structured JSON format for lessons:
```json
{
  "char": "見ます",
  "data1": "みます",
  "mean": "ดู, มอง, ตรวจ"
}