m_translation.js

//1
//Ưu tiên từ dài nhất trong từ điển tính từ chữ ĐẦU TIÊN nó thấy
if (!bestMatch) {
    const longestMatch = state.dictionaryTrie.findLongestMatch(line, i);
    if (longestMatch) {
        bestMatch = longestMatch;
    }
}
//1 END

//2
if (!bestMatch) {
    // Bước 1: Tìm TẤT CẢ các từ có thể khớp, từ ngắn đến dài
    const allMatches = state.dictionaryTrie.findAllMatches(line, i);
    if (allMatches.length > 0) {
        // Bước 2: Tạm thời chọn từ dài nhất làm ứng cử viên
        let bestChoice = allMatches[allMatches.length - 1];

        // Bước 3: Nếu có nhiều hơn 1 lựa chọn (ví dụ: '在' và '在劫')
        if (allMatches.length > 1) {
            const longestMatch = bestChoice;

            // Lặp qua các lựa chọn NGẮN HƠN để xem có lựa chọn nào tốt hơn không
            for (const currentMatch of allMatches) {
                if (currentMatch.key.length >= longestMatch.key.length) continue;

                const next_i = i + currentMatch.key.length;
                if (next_i >= line.length) continue;

                // Bước 4: "Nhìn về phía trước" để xem từ tiếp theo sẽ là gì
                const nextMatch = state.dictionaryTrie.findLongestMatch(line, next_i);

                // Bước 5: So sánh và đưa ra quyết định thông minh
                // Điều kiện quan trọng:
                // Chỉ chọn từ ngắn hơn ('在') KHI VÀ CHỈ KHI
                // từ tiếp theo nó tìm được ('劫云中') dài hơn hẳn từ dài nhất ban đầu ('在劫').
                // Điều này tránh việc phá vỡ các từ bình thường như '词语'.
                if (nextMatch && nextMatch.key.length > longestMatch.key.length) {
                    bestChoice = currentMatch; // Tìm thấy một phương án tốt hơn
                    break; // Dừng lại và chọn phương án này
                }
            }
        }
        bestMatch = bestChoice;
    }
}
//2 END

