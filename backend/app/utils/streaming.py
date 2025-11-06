# app/utils/streaming.py

import io

class LineIterator:
    """
    Wraps the event stream from SageMaker so it can be iterated line by line.
    """
    def __init__(self, event_stream):
        self.event_stream = event_stream
        self.buffer = b""

    def __iter__(self):
        return self

    def __next__(self):
        while b"\n" not in self.buffer:
            chunk = self.event_stream.read(1024)
            if not chunk:
                if self.buffer:
                    line = self.buffer
                    self.buffer = b""
                    return line
                else:
                    raise StopIteration
            self.buffer += chunk

        line, self.buffer = self.buffer.split(b"\n", 1)
        return line
