Attribute VB_Name = "modFinish"
Option Explicit

' Finish button of the exam template (v1, spike S3).
' Saves a copy of this workbook to the TEMP folder, posts its bytes to
' WHE_ServerUrl & "/api/submissions/macro" as application/octet-stream with
' header X-Attempt-Token, shows the server's answer and deletes the copy.
' This workbook itself is never saved or closed here, so a failed send
' leaves it open as it was.
' It posts only to WHE_ServerUrl. No key or password lives in this module.
' Identifiers are spelled so that none differs from another only by case:
' the VBA editor would re-case one of them and change the source.

Private Const SUBMIT_PATH As String = "/api/submissions/macro"
Private Const BOX_TITLE As String = "Finish"

' ServerXMLHTTP timeouts in milliseconds: resolve, connect, send, receive.
Private Const TIMEOUT_RESOLVE As Long = 10000
Private Const TIMEOUT_CONNECT As Long = 15000
Private Const TIMEOUT_SEND As Long = 60000
Private Const TIMEOUT_RECEIVE As Long = 60000

Public Sub Finish()
    Dim attemptToken As String
    Dim serverUrl As String
    Dim copyPath As String
    Dim fileNo As Integer
    Dim fileBytes() As Byte
    Dim byteCount As Long
    Dim xhr As Object
    Dim stepName As String
    Dim errNumber As Long
    Dim errText As String

    attemptToken = PropertyText("WHE_AttemptToken")
    serverUrl = PropertyText("WHE_ServerUrl")
    If Len(attemptToken) = 0 Or LCase$(Left$(serverUrl, 8)) <> "https://" Then
        MsgBox "File ini tidak berisi data ujian yang lengkap." & vbCrLf & vbCrLf & _
               "Unduh ulang file ujian dari aplikasi.", vbCritical, BOX_TITLE
        Exit Sub
    End If

    On Error GoTo Failed

    stepName = "menyimpan salinan file"
    copyPath = TempCopyPath()
    ThisWorkbook.SaveCopyAs copyPath

    stepName = "membaca salinan file"
    fileNo = FreeFile
    Open copyPath For Binary Access Read As #fileNo
    byteCount = LOF(fileNo)
    ReDim fileBytes(0 To byteCount - 1)
    Get #fileNo, , fileBytes
    Close #fileNo
    fileNo = 0

    stepName = "mengirim file ke server"
    Set xhr = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    xhr.setTimeouts TIMEOUT_RESOLVE, TIMEOUT_CONNECT, TIMEOUT_SEND, TIMEOUT_RECEIVE
    xhr.Open "POST", SubmitUrl(serverUrl), False
    xhr.setRequestHeader "Content-Type", "application/octet-stream"
    xhr.setRequestHeader "X-Attempt-Token", attemptToken
    ' In parentheses so the array goes by value: a ByRef Byte() reaches
    ' ServerXMLHTTP as VT_BYREF|VT_ARRAY, which send rejects (E_INVALIDARG).
    xhr.send (fileBytes)

    DeleteCopy copyPath
    ShowAnswer xhr.Status, xhr.responseText, byteCount
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
    MsgBox "Gagal " & stepName & "." & vbCrLf & vbCrLf & _
           "Workbook ini tetap terbuka dan tidak berubah. Periksa koneksi internet, lalu klik Finish lagi." & _
           vbCrLf & vbCrLf & "Detail: " & errText & " (" & errNumber & ")", vbExclamation, BOX_TITLE
End Sub

Private Sub ShowAnswer(ByVal httpStatus As Long, ByVal answerText As String, ByVal byteCount As Long)
    Dim msg As String
    Dim boxStyle As VbMsgBoxStyle

    If httpStatus = 200 And InStr(1, answerText, """ok"":true", vbBinaryCompare) > 0 Then
        msg = "Terkirim. Server menerima file ini." & vbCrLf & vbCrLf & _
              "Ukuran file: " & byteCount & " byte"
        boxStyle = vbInformation
    ElseIf InStr(1, answerText, """ok"":false", vbBinaryCompare) > 0 Then
        msg = "Server menolak file ini." & vbCrLf & vbCrLf & _
              "Kode: " & AnswerCode(answerText) & vbCrLf & _
              "Ukuran file: " & byteCount & " byte"
        boxStyle = vbExclamation
    Else
        msg = "Gagal mengirim file: server membalas HTTP " & httpStatus & "." & vbCrLf & vbCrLf & _
              "Workbook ini tetap terbuka dan tidak berubah. Klik Finish lagi nanti."
        boxStyle = vbExclamation
    End If
    MsgBox msg, boxStyle, BOX_TITLE
End Sub

' The code of a JSON answer {"ok":false,"code":"..."}; "(tidak ada)" when absent.
Private Function AnswerCode(ByVal answerText As String) As String
    Const CODE_KEY As String = """code"":"""
    Dim codeStart As Long
    Dim codeEnd As Long

    AnswerCode = "(tidak ada)"
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

' A new file name in the TEMP folder, with the workbook's own extension.
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
