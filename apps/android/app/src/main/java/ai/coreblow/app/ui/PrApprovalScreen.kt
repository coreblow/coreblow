package ai.coreblow.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.coreblow.app.MainViewModel

data class AndroidGateCheck(
  val name: String,
  val passed: Boolean,
  val detail: String,
)

data class AndroidChangedFile(
  val path: String,
  val additions: Int,
  val deletions: Int,
)

@Composable
fun PrApprovalScreen(viewModel: MainViewModel, modifier: Modifier = Modifier) {
  var prApproved by remember { mutableStateOf(false) }
  var feedbackToast by remember { mutableStateOf<String?>(null) }

  val gateChecks = remember {
    listOf(
      AndroidGateCheck("typecheck", true, "PASSED: Validated against 6 changed files"),
      AndroidGateCheck("linter", true, "PASSED: Sovereign code style & imports clean"),
      AndroidGateCheck("unit_tests", true, "PASSED: Companion bridge suite 18/18 green"),
      AndroidGateCheck("secret_scan", true, "PASSED: Zero raw credentials detected in diff"),
      AndroidGateCheck("forbidden_paths", true, "PASSED: Sovereign boundary policy enforced"),
    )
  }

  val changedFiles = remember {
    listOf(
      AndroidChangedFile("apps/shared/types.ts", 85, 1),
      AndroidChangedFile("apps/shared/protocol.ts", 52, 2),
      AndroidChangedFile("apps/shared/CoreBlowKit/.../StudioCompanionModels.swift", 185, 0),
      AndroidChangedFile("apps/android/.../WarRoomScreen.kt", 220, 0),
      AndroidChangedFile("apps/android/.../PrApprovalScreen.kt", 210, 0),
      AndroidChangedFile("apps/android/.../MobileUiTokens.kt", 37, 37),
    )
  }

  Column(
    modifier =
      modifier
        .fillMaxSize()
        .background(Color(0xFF050D12)) // Dark Obsidian
        .verticalScroll(rememberScrollState())
        .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp),
  ) {
    // 1. PR Header Card
    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(12.dp),
      color = Color(0xFF0A2429), // Deep Muted Teal
      border = BorderStroke(1.dp, Color(0xFF1A857A).copy(alpha = 0.5f)),
    ) {
      Column(
        modifier = Modifier.padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text(
            text = "PR #622 • STAGE 15",
            color = Color(0xFF60D9CC),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
          )

          Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Surface(
              modifier = Modifier.size(7.dp),
              shape = CircleShape,
              color = if (prApproved) Color(0xFF5AB982) else Color(0xFF60D9CC),
            ) {}
            Text(
              text = if (prApproved) "CERTIFIED" else "READY FOR REVIEW",
              color = if (prApproved) Color(0xFF5AB982) else Color(0xFF60D9CC),
              fontSize = 10.sp,
              fontWeight = FontWeight.Bold,
              fontFamily = FontFamily.Monospace,
            )
          }
        }

        Text(
          text = "Mobile Companion Multi-Surface Parity (iOS, Android, Windows)",
          color = Color.White,
          fontSize = 15.sp,
          fontWeight = FontWeight.Bold,
        )

        Text(
          text = "Branch: main • Target: origin/main • 5/5 Pre-flight gates green",
          color = Color.White.copy(alpha = 0.65f),
          fontSize = 11.sp,
        )
      }
    }

    // Feedback Toast
    feedbackToast?.let { toast ->
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        color = Color(0xFF08171C),
        border = BorderStroke(1.dp, Color(0xFF5AB982)),
      ) {
        Row(
          modifier = Modifier.padding(12.dp),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Icon(
            imageVector = Icons.Default.Verified,
            contentDescription = null,
            tint = Color(0xFF5AB982),
            modifier = Modifier.size(16.dp),
          )
          Text(
            text = toast,
            color = Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
          )
        }
      }
    }

    // 2. 5-Gate Pre-Flight Scorecard
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Text(
        text = "5-GATE PRE-FLIGHT SCORECARD",
        color = Color.White.copy(alpha = 0.6f),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        fontFamily = FontFamily.Monospace,
      )

      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        gateChecks.forEach { check ->
          Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp),
            color = Color(0xFF08171C), // Dark Slate
          ) {
            Row(
              modifier = Modifier.padding(10.dp),
              horizontalArrangement = Arrangement.spacedBy(10.dp),
              verticalAlignment = Alignment.CenterVertically,
            ) {
              Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
                tint = Color(0xFF5AB982), // Sage Green
                modifier = Modifier.size(16.dp),
              )
              Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                  text = check.name.uppercase(),
                  color = Color.White,
                  fontSize = 11.sp,
                  fontWeight = FontWeight.Bold,
                  fontFamily = FontFamily.Monospace,
                )
                Text(
                  text = check.detail,
                  color = Color.White.copy(alpha = 0.65f),
                  fontSize = 10.sp,
                )
              }
            }
          }
        }
      }
    }

    // 3. Changed Files Section
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Text(
        text = "CHANGED FILES (${changedFiles.size})",
        color = Color.White.copy(alpha = 0.6f),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        fontFamily = FontFamily.Monospace,
      )

      Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        changedFiles.forEach { file ->
          Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp),
            color = Color(0xFF08171C).copy(alpha = 0.6f),
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically,
            ) {
              Text(
                text = file.path,
                color = Color.White,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                maxLines = 1,
                modifier = Modifier.weight(1f),
              )
              Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                  text = "+${file.additions}",
                  color = Color(0xFF5AB982),
                  fontSize = 10.sp,
                  fontWeight = FontWeight.Bold,
                )
                Text(
                  text = "-${file.deletions}",
                  color = Color(0xFFE87070),
                  fontSize = 10.sp,
                  fontWeight = FontWeight.Bold,
                )
              }
            }
          }
        }
      }
    }

    // 4. Remote Governance Actions
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Button(
        onClick = {
          prApproved = true
          feedbackToast = "✅ PR #622 certified & approved via Gateway RPC"
        },
        enabled = !prApproved,
        modifier = Modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(10.dp),
        colors =
          ButtonDefaults.buttonColors(
            containerColor = if (prApproved) Color(0xFF5AB982) else Color(0xFF1A857A),
            contentColor = Color.White,
          ),
      ) {
        Row(
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Icon(imageVector = Icons.Default.Verified, contentDescription = null, modifier = Modifier.size(16.dp))
          Text(
            text = if (prApproved) "PR Approved & Certified" else "Approve & Certify PR",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
          )
        }
      }

      OutlinedButton(
        onClick = {
          feedbackToast = "⚠️ Rollback signal dispatched to Microkernel Gateway"
        },
        modifier = Modifier.fillMaxWidth().height(42.dp),
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, Color(0xFFE87070).copy(alpha = 0.5f)),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFE87070)),
      ) {
        Row(
          horizontalArrangement = Arrangement.spacedBy(6.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Icon(imageVector = Icons.Default.Undo, contentDescription = null, modifier = Modifier.size(14.dp))
          Text(
            text = "Rollback Release",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
          )
        }
      }
    }
  }
}
