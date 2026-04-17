### 1단계: Google Sheets 준비

1. [Google Sheets](https://sheets.new)를 새로 생성합니다.
2. 하단 시트 탭 이름을 `Sequences`로 변경합니다.
3. 1행부터 바로 데이터를 넣으시면 됩니다. 헤더(json_data 등)가 필요 없습니다.
   - *참고: 이제 1행부터 모든 행을 데이터로 인식하며, 행 번호가 곧 ID가 됩니다.*

### 2단계: Apps Script 코드 작성

1. 도구 메뉴의 **확장 프로그램 > Apps Script**를 클릭합니다.
2. 기존 코드를 모두 삭제하고 아래 코드를 복사해서 붙여넣습니다.

```javascript
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SHEET_NAME = 'Sequences';

function doGet(e) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const result = {};
  
  // 1행부터 모든 행을 데이터로 처리
  for (let i = 0; i < data.length; i++) {
    const jsonStr = data[i][0]; 
    if (!jsonStr || jsonStr.toString().trim() === "") continue;
    
    const id = `row-${i + 1}`; // 1행은 row-1, 2행은 row-2 ...
    try {
      result[id] = JSON.parse(jsonStr);
    } catch (err) {
      result[id] = null;
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid JSON' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const { id, data: jsonData } = params;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const jsonString = JSON.stringify(jsonData);
  
  // ID가 'row-X' 형식인 경우 해당 행에 직접 저장
  if (id && id.startsWith('row-')) {
    const rowNum = parseInt(id.replace('row-', ''));
    if (!isNaN(rowNum) && rowNum > 0) {
      sheet.getRange(rowNum, 1).setValue(jsonString);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // ID가 없거나 형식이 다르면 새 행 추가
  sheet.appendRow([jsonString]);
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 3단계: 웹 앱 배포

1. 우측 상단 **배포 > 새 배포**를 클릭합니다.
2. 유형 선택에서 **웹 앱**을 선택합니다.
3. 설정:
   - 설명: `Yoga Sequence API`
   - 다음 사용자로 실행: **나**
   - 액세스할 수 있는 사용자: **모든 사람 (Anyone)** (중요!)
4. **배포**를 클릭하고 승인 절차를 거친 후 생성된 **웹 앱 URL**을 복사해 두세요.
