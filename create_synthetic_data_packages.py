import quilt3

def move_nothing(lk, entry):
    return False

def create_10kb_pkg():
    pass

def create_100kb_pkg():
    pass

def create_1mb_pkg():
    pass

def create_10mb_pkg():
    pass



def create_100mb_pkg():
    pkg = quilt3.Package()
    pkg.set_dir("100mb/", "s3://quilt-ml-data/data/download_benchmark/100mb/")
    pkg.push("download-benchmark/100mb", registry="s3://quilt-ml-data/", selector_fn=move_nothing)


def create_1gb_pkg():
    pass

def create_10gb_pkg():
    pass


if __name__ == '__main__':
    create_100mb_pkg()


