#!/bin/bash
killall -9 node 2>/dev/null || true
sleep 1
npm start