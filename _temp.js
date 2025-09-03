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

//3
if (!bestMatch) {
    // Thuật toán "Tổng Độ Dài Tối Ưu" để giải quyết xung đột triệt để.
    const allMatches = state.dictionaryTrie.findAllMatches(line, i);

    if (allMatches.length > 0) {
        // Nếu chỉ có một lựa chọn, không cần so sánh.
        if (allMatches.length === 1) {
            bestMatch = allMatches[0];
        } else {
            // Mặc định, luôn ưu tiên từ dài nhất.
            const longestMatch = allMatches[allMatches.length - 1];
            let bestChoice = longestMatch;

            // Lặp qua các lựa chọn ngắn hơn để tìm phương án tốt hơn.
            for (const currentShortMatch of allMatches) {
                if (currentShortMatch.key.length >= longestMatch.key.length) continue;

                // Tìm từ tiếp theo sau từ ngắn.
                const next_i = i + currentShortMatch.key.length;
                if (next_i >= line.length) continue;
                const nextMatch = state.dictionaryTrie.findLongestMatch(line, next_i);

                // Nếu không có từ tiếp theo, không thể so sánh, bỏ qua.
                if (!nextMatch) continue;

                // So sánh "Tổng Độ Dài": (ngắn + tiếp theo) vs (dài ban đầu).
                const combinedLength = currentShortMatch.key.length + nextMatch.key.length;

                if (combinedLength > longestMatch.key.length) {
                    // Nếu tổng độ dài lớn hơn, phương án chọn từ ngắn là tối ưu hơn.
                    bestChoice = currentShortMatch;
                    break; // Đã tìm thấy phương án tốt nhất, dừng lại.
                }
            }
            bestMatch = bestChoice;
        }
    }
}
//3 END



/**


**T1
Từ gốc
将会变得更强
Bị tách thành
将 会 变得更强
có định nghĩa
将会 và 变得更强
-> DỊCH ĐÚNG 将会 变得更强

**T2
Từ gốc
在劫云中
Bị tách thành
在劫 云中 
Có định nghĩa
在 và 劫云中
-> DỊCH ĐÚNG 在 劫云中

***S1
so sánh "độ dài của từ tiếp theo" với "độ dài của từ dài ban đầu"
so sánh "Tổng Độ Dài Tối Ưu"


**/