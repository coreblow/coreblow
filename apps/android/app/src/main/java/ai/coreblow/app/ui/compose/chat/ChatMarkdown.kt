package ai.coreblow.app.ui.compose.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Renders markdown-flavored chat text with inline code, bold, italic,
 * code blocks, headers, lists, and links.
 */
@Composable
fun ChatMarkdown(
    text: String,
    modifier: Modifier = Modifier,
    isAssistant: Boolean = false,
) {
    val parsed = remember(text) { parseMarkdown(text) }

    SelectionContainer {
        Column(modifier = modifier) {
            for (block in parsed) {
                when (block) {
                    is MarkdownBlock.Paragraph -> {
                        Text(
                            text = block.annotated,
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                            color = if (isAssistant) MaterialTheme.colorScheme.onSurface
                                    else MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                    }
                    is MarkdownBlock.CodeBlock -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
                                .padding(12.dp),
                        ) {
                            Text(
                                text = block.code,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 12.sp,
                                lineHeight = 16.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    is MarkdownBlock.Header -> {
                        Text(
                            text = block.text,
                            fontSize = when (block.level) {
                                1 -> 20.sp; 2 -> 18.sp; 3 -> 16.sp; else -> 14.sp
                            },
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    is MarkdownBlock.ListItem -> {
                        Row(modifier = Modifier.padding(start = 8.dp, bottom = 4.dp)) {
                            Text(
                                text = if (block.ordered) "${block.index}. " else "• ",
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                text = block.annotated,
                                fontSize = 14.sp,
                                lineHeight = 20.sp,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                    is MarkdownBlock.Divider -> {
                        Spacer(modifier = Modifier.height(4.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(MaterialTheme.colorScheme.outlineVariant),
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                }
            }
        }
    }
}

// MARK: - Parser

internal sealed class MarkdownBlock {
    data class Paragraph(val annotated: AnnotatedString) : MarkdownBlock()
    data class CodeBlock(val code: String, val language: String?) : MarkdownBlock()
    data class Header(val text: String, val level: Int) : MarkdownBlock()
    data class ListItem(val annotated: AnnotatedString, val ordered: Boolean, val index: Int) : MarkdownBlock()
    object Divider : MarkdownBlock()
}

internal fun parseMarkdown(raw: String): List<MarkdownBlock> {
    val blocks = mutableListOf<MarkdownBlock>()
    val lines = raw.lines()
    var i = 0

    while (i < lines.size) {
        val line = lines[i]

        // Fenced code block
        if (line.trimStart().startsWith("```")) {
            val lang = line.trimStart().removePrefix("```").trim().takeIf { it.isNotEmpty() }
            val codeLines = mutableListOf<String>()
            i++
            while (i < lines.size && !lines[i].trimStart().startsWith("```")) {
                codeLines.add(lines[i])
                i++
            }
            if (i < lines.size) i++ // skip closing ```
            blocks.add(MarkdownBlock.CodeBlock(codeLines.joinToString("\n"), lang))
            continue
        }

        // Header
        val headerMatch = Regex("^(#{1,4})\\s+(.+)").find(line)
        if (headerMatch != null) {
            val level = headerMatch.groupValues[1].length
            val text = headerMatch.groupValues[2].trim()
            blocks.add(MarkdownBlock.Header(text, level))
            i++
            continue
        }

        // Divider
        if (line.trim().matches(Regex("^[-*_]{3,}$"))) {
            blocks.add(MarkdownBlock.Divider)
            i++
            continue
        }

        // Unordered list
        val ulMatch = Regex("^\\s*[-*+]\\s+(.+)").find(line)
        if (ulMatch != null) {
            blocks.add(MarkdownBlock.ListItem(parseInline(ulMatch.groupValues[1]), ordered = false, index = 0))
            i++
            continue
        }

        // Ordered list
        val olMatch = Regex("^\\s*(\\d+)[.)\\s]+(.+)").find(line)
        if (olMatch != null) {
            blocks.add(MarkdownBlock.ListItem(parseInline(olMatch.groupValues[2]), ordered = true, index = olMatch.groupValues[1].toIntOrNull() ?: 1))
            i++
            continue
        }

        // Blank line
        if (line.isBlank()) {
            i++
            continue
        }

        // Paragraph
        val paraLines = mutableListOf(line)
        i++
        while (i < lines.size && lines[i].isNotBlank() && !lines[i].trimStart().startsWith("```") && !lines[i].trimStart().startsWith("#")) {
            paraLines.add(lines[i])
            i++
        }
        blocks.add(MarkdownBlock.Paragraph(parseInline(paraLines.joinToString(" "))))
    }

    return blocks
}

internal fun parseInline(text: String): AnnotatedString {
    return buildAnnotatedString {
        var remaining = text
        while (remaining.isNotEmpty()) {
            // Bold **text**
            val boldMatch = Regex("^\\*\\*(.+?)\\*\\*").find(remaining)
            if (boldMatch != null) {
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(boldMatch.groupValues[1]) }
                remaining = remaining.removePrefix(boldMatch.value)
                continue
            }

            // Italic *text*
            val italicMatch = Regex("^\\*(.+?)\\*").find(remaining)
            if (italicMatch != null) {
                withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(italicMatch.groupValues[1]) }
                remaining = remaining.removePrefix(italicMatch.value)
                continue
            }

            // Inline code `code`
            val codeMatch = Regex("^`([^`]+)`").find(remaining)
            if (codeMatch != null) {
                withStyle(SpanStyle(fontFamily = FontFamily.Monospace, background = Color(0x20808080))) {
                    append(codeMatch.groupValues[1])
                }
                remaining = remaining.removePrefix(codeMatch.value)
                continue
            }

            // Link [text](url)
            val linkMatch = Regex("^\\[(.+?)]\\((.+?)\\)").find(remaining)
            if (linkMatch != null) {
                withStyle(SpanStyle(color = Color(0xFF4A90D9))) { append(linkMatch.groupValues[1]) }
                remaining = remaining.removePrefix(linkMatch.value)
                continue
            }

            // Plain char
            append(remaining[0])
            remaining = remaining.drop(1)
        }
    }
}
