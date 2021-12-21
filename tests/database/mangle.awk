#!/usr/bin/awk -f

BEGIN {
  PRINT = 0;
  pattern = "\\y" pattern "(|_id_seq)\\y";
}

$0 !~ pattern && PRINT == 0 {
  last = $0;
  next;
}

$0 ~ pattern {
  if (PRINT == 0) {
    print last;
    PRINT = 1;
  }
  print $0;

  if ($0 ~ /^$/) {
    PRINT = 0;
  }
}

$0 !~ pattern && PRINT == 1 {
  print $0;

  if ($0 ~ /^$/) {
    PRINT = 0;
  }
}


