using CoreBlow.WindowsNode;
using Xunit;

namespace CoreBlow.WindowsNode.Tests;

public sealed class NodeStatusTests
{
    [Fact]
    public void RunningNodeCanOpenDashboard()
    {
        Assert.True(NodeStatus.Normalize(" Running ", 1).CanOpenDashboard);
    }

    [Fact]
    public void ActiveConnectionsNeverGoesNegative()
    {
        Assert.Equal(0, NodeStatus.Normalize("stopped", -2).ActiveConnections);
    }
}
