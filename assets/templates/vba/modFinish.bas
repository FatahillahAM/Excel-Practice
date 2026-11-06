Attribute VB_Name = "modFinish"
Option Explicit

' Finish button of the exam template (v1, story 2.9).
' Saves this workbook, saves a copy of it to the TEMP folder, posts the copy's
' bytes to WHE_ServerUrl & "/api/submissions/macro" as application/octet-stream
' with header X-Attempt-Token, deletes the copy and shows one message box for
' the answer. Only HTTP 200 with "ok":true is success: then this workbook
' closes, and Excel quits when no other workbook has a visible window. On any
' other answer or error the workbook stays open and the copy is deleted.
' The texts are macroMessages in src/messages/id.ts, the one source; a test
' checks that each is here. The file is ASCII: the em dash is ChrW$(8212).
' It posts only to WHE_ServerUrl. No key or password lives in this module.
' Identifiers are spelled so that none differs from another only by case:
' the VBA editor would re-case one of them and change the source.

Private Const SUBMIT_PATH As String = "/api/submissions/macro"
Private Const BOX_TITLE As String = "Finish"

' MAX_SUBMISSION_BYTES of src/core/submission/submit.ts (4 MiB). A larger file
' is refused here without sending; the server answers 413 for it anyway.
Private Const MAX_SUBMISSION_BYTES As Long = 4194304

' ServerXMLHTTP timeouts in milliseconds: resolve, connect, send, receive.
Private Const TIMEOUT_RESOLVE As Long = 10000
Private Const TIMEOUT_CONNECT As Long = 15000
Private Const TIMEOUT_SEND As Long = 60000
Private Const TIMEOUT_RECEIVE As Long = 60000

' The step Finish is in, to pick the message of an error.
Private Const STEP_SAVE As Long = 1
Private Const STEP_COPY As Long = 2
Private Const STEP_SEND As Long = 3

' WinHTTP errors of the secure connection (certificate, secure channel). Any
' other send error, e.g. -2147012889 (name not resolved), is the network row.
Private Const WINHTTP_SECURE_FAILURE As Long = -2147012721
Private Const WINHTTP_SECURE_CHANNEL_ERROR As Long = -2147012739
Private Const WINHTTP_SECURE_CERT_DATE_INVALID As Long = -2147012859
Private Const WINHTTP_SECURE_CERT_CN_INVALID As Long = -2147012858
Private Const WINHTTP_SECURE_INVALID_CA As Long = -2147012851
Private Const WINHTTP_SECURE_CERT_REV_FAILED As Long = -2147012839

' Message texts (macroMessages). The two with an em dash are functions below.
Private Const MSG_SENT As String = "File terkirim! Hasilnya muncul di web, ya."
Private Const MSG_NOT_THIS_ATTEMPT As String = "File ini bukan dari percobaan yang sedang berjalan. Upload file yang kamu unduh waktu klik Start, ya."
Private Const MSG_ALREADY_GRADED As String = "File ini sudah dinilai. Hasilnya ada di History, ya."
Private Const MSG_IDENTITY_ALTERED As String = "Identitas file ini rusak atau berubah. Pakai file .xlsm asli dari Start dan jangan Save As ke format lain, ya."
Private Const MSG_ATTEMPT_CLOSED As String = "Percobaan ini sudah ditutup, jadi file-nya nggak bisa dinilai. Mulai percobaan baru, ya."
Private Const MSG_NOT_EXCEL As String = "Server nggak bisa membaca file ini sebagai file Excel. Upload file ini lewat web, ya."
Private Const MSG_TOO_LARGE As String = "File ini terlalu besar (maksimal 4 MB). Pakai file .xlsm asli dari Start, ya."
Private Const MSG_TLS_FAILED As String = "Koneksi aman ke server gagal. Biasanya karena tanggal dan jam laptop salah, bukan internet kamu. Cek jamnya lalu klik Finish lagi, atau upload lewat web, ya."
Private Const MSG_SAVE_FAILED As String = "File belum bisa disimpan, jadi belum dikirim. Simpan dulu ke folder kerja kamu (Ctrl+S), lalu klik Finish lagi, ya."
Private Const MSG_INCOMPLETE As String = "File ini tidak berisi data ujian yang lengkap."
Private Const MSG_INCOMPLETE_NEXT As String = "Unduh ulang file ujian dari aplikasi."
Private Const LABEL_CODE As String = "Kode: "
Private Const LABEL_DETAIL As String = "Detail: "

Public Sub Finish()
    Dim attemptToken As String
    Dim serverUrl As String
    Dim copyPath As String
    Dim fileNo As Integer
    Dim fileBytes() As Byte
    Dim byteCount As Long
    Dim xhr As Object
    Dim httpStatus As Long
    Dim answerText As String
    Dim stepNo As Long
    Dim errNumber As Long
    Dim errText As String

    attemptToken = PropertyText("WHE_AttemptToken")
    serverUrl = PropertyText("WHE_ServerUrl")
    If Len(attemptToken) = 0 Or LCase$(Left$(serverUrl, 8)) <> "https://" Then
        MsgBox MSG_INCOMPLETE & vbCrLf & vbCrLf & MSG_INCOMPLETE_NEXT, vbCritical, BOX_TITLE
        Exit Sub
    End If

    On Error GoTo Failed

    stepNo = STEP_SAVE
    If ThisWorkbook.ReadOnly Or Len(ThisWorkbook.Path) = 0 Then
        Err.Raise vbObjectError + 514, "modFinish", "Workbook ini read-only atau belum pernah disimpan."
    End If
    ThisWorkbook.Save

    byteCount = SavedFileSize()
    If byteCount > MAX_SUBMISSION_BYTES Then
        ShowRefusal MSG_TOO_LARGE, LABEL_DETAIL & byteCount & " byte"
        Exit Sub
    End If

    stepNo = STEP_COPY
    copyPath = TempCopyPath()
    ThisWorkbook.SaveCopyAs copyPath
    fileNo = FreeFile
    Open copyPath For Binary Access Read As #fileNo
    byteCount = LOF(fileNo)
    If byteCount = 0 Then Err.Raise vbObjectError + 515, "modFinish", "Salinan file kosong."
    If byteCount <= MAX_SUBMISSION_BYTES Then
        ReDim fileBytes(0 To byteCount - 1)
        Get #fileNo, , fileBytes
    End If
    Close #fileNo
    fileNo = 0
    If byteCount > MAX_SUBMISSION_BYTES Then
        DeleteCopy copyPath
        ShowRefusal MSG_TOO_LARGE, LABEL_DETAIL & byteCount & " byte"
        Exit Sub
    End If

    stepNo = STEP_SEND
    Set xhr = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    xhr.setTimeouts TIMEOUT_RESOLVE, TIMEOUT_CONNECT, TIMEOUT_SEND, TIMEOUT_RECEIVE
    xhr.Open "POST", SubmitUrl(serverUrl), False
    xhr.setRequestHeader "Content-Type", "application/octet-stream"
    xhr.setRequestHeader "X-Attempt-Token", attemptToken
    ' In parentheses so the array goes by value: a ByRef Byte() reaches
    ' ServerXMLHTTP as VT_BYREF|VT_ARRAY, which send rejects (E_INVALIDARG).
    xhr.send (fileBytes)
    httpStatus = xhr.Status
    answerText = xhr.responseText

    On Error GoTo 0
    DeleteCopy copyPath
    If ShowAnswer(httpStatus, answerText) Then CloseWorkbook
    Exit Sub

Failed:
    errNumber = Err.Number
    errText = Err.Description
    Resume ReportFailure

ReportFailure:
    On Error Resume Next
    If fileNo <> 0 Then Close #fileNo
    DeleteCopy copyPath
    On Error GoTo 0
    ShowRefusal FailureText(stepNo, errNumber), LABEL_DETAIL & errText & " (" & errNumber & ")"
End Sub

' Shows the message box for the server's answer; True when the file was accepted.
Private Function ShowAnswer(ByVal httpStatus As Long, ByVal answerText As String) As Boolean
    Dim msg As String
    Dim boxStyle As VbMsgBoxStyle
    Dim codeText As String

    boxStyle = vbExclamation
    If httpStatus = 200 And InStr(1, answerText, """ok"":true", vbBinaryCompare) > 0 Then
        msg = MSG_SENT
        boxStyle = vbInformation
        ShowAnswer = True
    ElseIf httpStatus = 413 Then
        ' The platform's own 413 is not JSON, so the status alone decides.
        msg = MSG_TOO_LARGE & vbCrLf & vbCrLf & LABEL_DETAIL & "HTTP 413"
    Else
        If httpStatus = 400 And InStr(1, answerText, """ok"":false", vbBinaryCompare) > 0 Then
            codeText = AnswerCode(answerText)
            msg = RejectionText(codeText)
        End If
        If Len(msg) > 0 Then
            msg = msg & vbCrLf & vbCrLf & LABEL_CODE & codeText
        Else
            codeText = AnswerCode(answerText)
            msg = SendFailedText() & vbCrLf & vbCrLf & LABEL_DETAIL & "HTTP " & httpStatus
            If Len(codeText) > 0 Then msg = msg & " " & codeText
        End If
    End If
    MsgBox msg, boxStyle, BOX_TITLE
End Function

' The message of an AD-6 rejection code; "" for any other code.
Private Function RejectionText(ByVal codeText As String) As String
    Select Case codeText
    Case "NOT_THIS_ATTEMPT"
        RejectionText = MSG_NOT_THIS_ATTEMPT
    Case "ALREADY_GRADED"
        RejectionText = MSG_ALREADY_GRADED
    Case "IDENTITY_ALTERED"
        RejectionText = MSG_IDENTITY_ALTERED
    Case "ATTEMPT_CLOSED"
        RejectionText = MSG_ATTEMPT_CLOSED
    Case "NOT_EXCEL"
        RejectionText = MSG_NOT_EXCEL
    Case Else
        RejectionText = ""
    End Select
End Function

' The message of an error raised in a step of Finish.
Private Function FailureText(ByVal stepNo As Long, ByVal errNumber As Long) As String
    Select Case stepNo
    Case STEP_SAVE
        FailureText = MSG_SAVE_FAILED
    Case STEP_COPY
        FailureText = TempFailedText()
    Case Else
        If IsTlsError(errNumber) Then
            FailureText = MSG_TLS_FAILED
        Else
            FailureText = SendFailedText()
        End If
    End Select
End Function

Private Function IsTlsError(ByVal errNumber As Long) As Boolean
    Select Case errNumber
    Case WINHTTP_SECURE_FAILURE, WINHTTP_SECURE_CHANNEL_ERROR, WINHTTP_SECURE_CERT_DATE_INVALID, _
         WINHTTP_SECURE_CERT_CN_INVALID, WINHTTP_SECURE_INVALID_CA, WINHTTP_SECURE_CERT_REV_FAILED
        IsTlsError = True
    Case Else
        IsTlsError = False
    End Select
End Function

Private Function SendFailedText() As String
    SendFailedText = "File belum terkirim. Filenya sudah tersimpan " & ChrW$(8212) & " upload lewat web, ya."
End Function

Private Function TempFailedText() As String
    TempFailedText = "Salinan file nggak bisa dibuat di folder TEMP Windows. Filenya sudah tersimpan " & ChrW$(8212) & " upload lewat web, ya."
End Function

' A refusal or failure: the workbook stays open.
Private Sub ShowRefusal(ByVal msg As String, ByVal detailLine As String)
    MsgBox msg & vbCrLf & vbCrLf & detailLine, vbExclamation, BOX_TITLE
End Sub

' After an accepted Finish. The file was saved before sending, so nothing is
' lost: close this workbook, or quit Excel when no other workbook is visible.
Private Sub CloseWorkbook()
    On Error Resume Next
    ThisWorkbook.Saved = True
    If OtherWorkbookVisible() Then
        ThisWorkbook.Close False
    Else
        Application.Quit
    End If
End Sub

' True when another workbook has a visible window (PERSONAL.XLSB is hidden).
Private Function OtherWorkbookVisible() As Boolean
    Dim book As Workbook
    Dim bookWindow As Window

    For Each book In Application.Workbooks
        If Not book Is ThisWorkbook Then
            For Each bookWindow In book.Windows
                If bookWindow.Visible Then
                    OtherWorkbookVisible = True
                    Exit Function
                End If
            Next bookWindow
        End If
    Next book
End Function

' The code of a JSON answer {"ok":false,"code":"..."}; "" when absent.
Private Function AnswerCode(ByVal answerText As String) As String
    Const CODE_KEY As String = """code"":"""
    Dim codeStart As Long
    Dim codeEnd As Long

    AnswerCode = ""
    codeStart = InStr(1, answerText, CODE_KEY, vbBinaryCompare)
    If codeStart = 0 Then Exit Function
    codeStart = codeStart + Len(CODE_KEY)
    codeEnd = InStr(codeStart, answerText, """", vbBinaryCompare)
    If codeEnd > codeStart Then AnswerCode = Mid$(answerText, codeStart, codeEnd - codeStart)
End Function

Private Function SubmitUrl(ByVal serverUrl As String) As String
    Do While Right$(serverUrl, 1) = "/"
        serverUrl = Left$(serverUrl, Len(serverUrl) - 1)
    Loop
    SubmitUrl = serverUrl & SUBMIT_PATH
End Function

' The saved workbook's size on disk; 0 when it cannot be read (e.g. a OneDrive
' URL), and then only the copy's size is checked.
Private Function SavedFileSize() As Long
    On Error Resume Next
    SavedFileSize = 0
    SavedFileSize = FileLen(ThisWorkbook.FullName)
End Function

' A new file name in the TEMP folder. Always .xlsm: SaveCopyAs keeps this
' workbook's format, and an exam file is a macro-enabled .xlsm.
Private Function TempCopyPath() As String
    Dim tempFolder As String

    tempFolder = Environ$("TEMP")
    If Len(tempFolder) = 0 Then tempFolder = Environ$("TMP")
    If Len(tempFolder) = 0 Then Err.Raise vbObjectError + 513, "modFinish", "Folder TEMP tidak ditemukan."
    If Right$(tempFolder, 1) <> "\" Then tempFolder = tempFolder & "\"
    Randomize
    TempCopyPath = tempFolder & "whe-finish-" & Format$(Now, "yyyymmdd-hhnnss") & "-" & _
                   CStr(Int(Rnd * 1000000)) & ".xlsm"
End Function

Private Sub DeleteCopy(ByVal copyPath As String)
    On Error Resume Next
    If Len(copyPath) > 0 Then
        If Len(Dir$(copyPath)) > 0 Then Kill copyPath
    End If
End Sub

Private Function PropertyText(ByVal propertyName As String) As String
    On Error GoTo Missing
    PropertyText = CStr(ThisWorkbook.CustomDocumentProperties(propertyName).Value)
    Exit Function
Missing:
    PropertyText = ""
End Function
