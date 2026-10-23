Attribute VB_Name = "modFinish"
Option Explicit

' Spike S1 test macro (exam template v1).
' Finish shows the three WHE_* custom document properties that the server
' writes into each generated workbook, so the token can be compared with the
' one printed by scripts/spike-s1.ts. Spike S3 extends Finish to save the
' workbook and send it to WHE_ServerUrl.
' No key or password lives in this module.

Public Sub Finish()
    Dim msg As String
    msg = "WHE_AttemptToken: " & PropertyText("WHE_AttemptToken") & vbCrLf & _
          "WHE_ServerUrl: " & PropertyText("WHE_ServerUrl") & vbCrLf & _
          "WHE_TemplateVersion: " & PropertyText("WHE_TemplateVersion")
    MsgBox msg, vbInformation, "Finish (spike S1)"
End Sub

Private Function PropertyText(ByVal propertyName As String) As String
    On Error GoTo Missing
    PropertyText = CStr(ThisWorkbook.CustomDocumentProperties(propertyName).Value)
    Exit Function
Missing:
    PropertyText = "(missing)"
End Function
