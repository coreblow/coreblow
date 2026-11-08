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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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

data class AndroidKanbanCard(
  val id: String,
  val title: String,
  val role: String, // "lead" | "coder" | "auditor" | "verifier"
  val column: String, // "Backlog" | "In Progress" | "Review" | "Done"
  val duration: String,
  val agentInitials: String,
)

@Composable
fun WarRoomScreen(viewModel: MainViewModel, modifier: Modifier = Modifier) {
  var selectedColumn by remember { mutableStateOf("In Progress") }
  val columns = remember { listOf("Backlog", "In Progress", "Review", "Done") }

  val cards = remember {
    listOf(
      AndroidKanbanCard(
        id = "card_1",
        title = "Coordinate Stage 15 multi-surface parity across iOS, Android, and Windows",
        role = "lead",
        column = "In Progress",
        duration = "2m 14s",
        agentInitials = "LA",
      ),
      AndroidKanbanCard(
        id = "card_2",
        title = "Implement Option 1 Zero-Fatigue palette across mobile Compose tokens",
        role = "coder",
        column = "In Progress",
        duration = "1m 05s",
        agentInitials = "DC",
      ),
      AndroidKanbanCard(
        id = "card_3",
        title = "Scan mobile trees for zero raw secrets and sovereign path enforcement",
        role = "auditor",
        column = "Review",
        duration = "45s",
        agentInitials = "SA",
      ),
      AndroidKanbanCard(
        id = "card_4",
        title = "Certify 5-Gate pre-flight scorecard and verify zero build warnings",
        role = "verifier",
        column = "Backlog",
        duration = "Pending",
        agentInitials = "PV",
      ),
      AndroidKanbanCard(
        id = "card_5",
        title = "Synchronize StudioCompanionModels across shared Swift target",
        role = "coder",
        column = "Done",
        duration = "5.81s",
        agentInitials = "DC",
      ),
    )
  }

  Column(
    modifier =
      modifier
        .fillMaxSize()
        .background(Color(0xFF050D12)), // Dark Obsidian
  ) {
    // 1. Column Filter Row
    LazyRow(
      modifier =
        Modifier
          .fillMaxWidth()
          .background(Color(0xFF08171C)) // Dark Slate
          .padding(horizontal = 12.dp, vertical = 8.dp),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      items(columns) { col ->
        val isSelected = col == selectedColumn
        val count = cards.count { it.column == col }
        Surface(
          onClick = { selectedColumn = col },
          shape = RoundedCornerShape(999.dp),
          color = if (isSelected) Color(0xFF0A2429) else Color(0xFF08171C),
          border = BorderStroke(1.dp, if (isSelected) Color(0xFF1A857A) else Color.White.copy(alpha = 0.08f)),
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
          ) {
            Text(
              text = col,
              color = if (isSelected) Color.White else Color.White.copy(alpha = 0.65f),
              fontSize = 12.sp,
              fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            )
            Surface(
              shape = RoundedCornerShape(999.dp),
              color = if (isSelected) Color(0xFF60D9CC) else Color.White.copy(alpha = 0.1f),
            ) {
              Text(
                text = "$count",
                color = if (isSelected) Color(0xFF050D12) else Color.White.copy(alpha = 0.5f),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp),
              )
            }
          }
        }
      }
    }

    // 2. Active Cards List
    val filteredCards = cards.filter { it.column == selectedColumn }
    LazyColumn(
      modifier =
        Modifier
          .weight(1f)
          .fillMaxWidth()
          .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      if (filteredCards.isEmpty()) {
        item {
          Box(
            modifier = Modifier.fillMaxWidth().padding(top = 40.dp),
            contentAlignment = Alignment.Center,
          ) {
            Text(
              text = "No active tasks in [$selectedColumn].",
              color = Color.White.copy(alpha = 0.5f),
              fontSize = 13.sp,
            )
          }
        }
      } else {
        items(filteredCards) { card ->
          KanbanCardItem(card = card)
        }
      }
    }

    // 3. Footer Fleet Status
    Surface(
      modifier = Modifier.fillMaxWidth(),
      color = Color(0xFF08171C),
      border = BorderStroke(1.dp, Color(0xFF103239)),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Row(
          horizontalArrangement = Arrangement.spacedBy(6.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Icon(
            imageVector = Icons.Default.Group,
            contentDescription = null,
            tint = Color(0xFF60D9CC),
            modifier = Modifier.size(16.dp),
          )
          Text(
            text = "Fleet: 4 Agents Active",
            color = Color.White.copy(alpha = 0.85f),
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
          )
        }
        Row(
          horizontalArrangement = Arrangement.spacedBy(6.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Surface(
            modifier = Modifier.size(7.dp),
            color = Color(0xFF5AB982),
            shape = CircleShape,
          ) {}
          Text(
            text = "DAG Synchronized",
            color = Color(0xFF5AB982),
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
          )
        }
      }
    }
  }
}

@Composable
private fun KanbanCardItem(card: AndroidKanbanCard) {
  val (roleTitle, roleColor, roleBg) =
    when (card.role) {
      "lead" -> Triple("LEAD ARCHITECT", Color(0xFF60D9CC), Color(0xFF0A2429))
      "coder" -> Triple("DEEP CODER", Color(0xFF5AB982), Color(0xFF143024))
      "auditor" -> Triple("SECURITY AUDITOR", Color(0xFFE8A844), Color(0xFF2E2212))
      "verifier" -> Triple("PRE-FLIGHT VERIFIER", Color(0xFF1A857A), Color(0xFF08171C))
      else -> Triple(card.role.uppercase(), Color.White, Color.Black.copy(alpha = 0.4f))
    }

  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(12.dp),
    color = Color(0xFF08171C), // Dark Slate
    border = BorderStroke(1.dp, Color(0xFF0A2429)), // Deep Muted Teal
  ) {
    Column(
      modifier = Modifier.padding(14.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Surface(
          shape = RoundedCornerShape(999.dp),
          color = roleBg,
        ) {
          Text(
            text = roleTitle,
            color = roleColor,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
          )
        }

        Row(
          horizontalArrangement = Arrangement.spacedBy(4.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Icon(
            imageVector = Icons.Default.Schedule,
            contentDescription = null,
            tint = Color.White.copy(alpha = 0.55f),
            modifier = Modifier.size(12.dp),
          )
          Text(
            text = card.duration,
            color = Color.White.copy(alpha = 0.55f),
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
          )
        }
      }

      Text(
        text = card.title,
        color = Color.White,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        lineHeight = 18.sp,
      )

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Row(
          horizontalArrangement = Arrangement.spacedBy(6.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Surface(
            modifier = Modifier.size(22.dp),
            shape = CircleShape,
            color = Color(0xFF1A857A),
          ) {
            Box(contentAlignment = Alignment.Center) {
              Text(
                text = card.agentInitials,
                color = Color.White,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
              )
            }
          }
          Text(
            text = "Subagent: ${card.role.uppercase()}",
            color = Color.White.copy(alpha = 0.65f),
            fontSize = 11.sp,
          )
        }
      }
    }
  }
}
